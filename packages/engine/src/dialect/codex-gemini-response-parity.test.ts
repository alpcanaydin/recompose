import { describe, expect, it } from 'vitest';

import type { GeminiResponse } from './gemini-wire';
import type { ResponsesStreamEvent } from './responses-wire';

import { translateResponse, translateStream } from './dispatcher';

describe('Codex terminal responses crossing Gemini', () => {
  it('should map incomplete max-output in stream and non-stream responses', async () => {
    const response = {
      id: 'resp_1',
      model: 'gpt-5.5',
      status: 'incomplete' as const,
      incomplete_details: { reason: 'max_output_tokens' },
      output: [],
      usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
    };
    const nonStream = translateResponse('responses', 'gemini', response);
    const stream = await streamed([{ type: 'response.incomplete', response }]);

    if ('outcome' in nonStream || 'refusal' in nonStream) throw new Error('expected response');

    expect(nonStream.value).toHaveProperty('candidates.0.finishReason', 'MAX_TOKENS');
    expect(stream).toContainEqual(
      expect.objectContaining({
        candidates: [expect.objectContaining({ finishReason: 'MAX_TOKENS' })],
      }),
    );
  });

  it('should use output_item.done message text when terminal output is empty', async () => {
    const events = await streamed([
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'ok' }],
        },
      },
      {
        type: 'response.completed',
        response: {
          id: 'resp_1',
          status: 'completed',
          output: [],
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      },
    ]);

    expect(events).toContainEqual(
      expect.objectContaining({
        candidates: [
          expect.objectContaining({ content: { role: 'model', parts: [{ text: 'ok' }] } }),
        ],
      }),
    );
  });
});

describe('Codex generated images crossing Gemini', () => {
  it('should emit one inline image for a partial and suppress its duplicate', async () => {
    const partial: ResponsesStreamEvent = {
      type: 'response.image_generation_call.partial_image',
      item_id: 'ig_123',
      output_format: 'png',
      partial_image_b64: 'aGVsbG8=',
      partial_image_index: 0,
    };
    const events = await streamed([partial, partial]);

    expect(imageParts(events)).toEqual([
      { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } },
    ]);
  });

  it('should suppress an identical final image after a partial', async () => {
    const events = await streamed([
      {
        type: 'response.image_generation_call.partial_image',
        item_id: 'ig_123',
        output_format: 'png',
        partial_image_b64: 'aGVsbG8=',
      },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          id: 'ig_123',
          type: 'image_generation_call',
          output_format: 'png',
          result: 'aGVsbG8=',
        },
      },
    ]);

    expect(imageParts(events)).toHaveLength(1);
  });

  it('should add a non-stream image generation result as inline data', () => {
    const translated = translateResponse('responses', 'gemini', {
      id: 'resp_1',
      status: 'completed',
      output: [{ type: 'image_generation_call', output_format: 'png', result: 'aGVsbG8=' }],
    });

    if ('outcome' in translated || 'refusal' in translated) throw new Error('expected response');

    expect(translated.value).toHaveProperty('candidates.0.content.parts.0.inlineData', {
      mimeType: 'image/png',
      data: 'aGVsbG8=',
    });
  });
});

describe('Codex function calls crossing Gemini', () => {
  it('should preserve function IDs in stream and non-stream responses', async () => {
    const nonStream = translateResponse('responses', 'gemini', {
      id: 'resp_1',
      status: 'completed',
      output: [
        { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{"q":"x"}' },
      ],
    });
    const stream = await streamed([
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          type: 'function_call',
          id: 'call_1',
          call_id: 'call_1',
          name: 'lookup',
          arguments: '{"q":"x"}',
        },
      },
    ]);

    if ('outcome' in nonStream || 'refusal' in nonStream) throw new Error('expected response');

    expect(nonStream.value).toHaveProperty(
      'candidates.0.content.parts.0.functionCall.id',
      'call_1',
    );
    expect(stream).toContainEqual(
      expect.objectContaining({
        candidates: [
          expect.objectContaining({
            content: {
              role: 'model',
              parts: [
                expect.objectContaining({
                  functionCall: { id: 'call_1', name: 'lookup', args: { q: 'x' } },
                }),
              ],
            },
          }),
        ],
      }),
    );
  });
});

async function streamed(events: readonly ResponsesStreamEvent[]) {
  const translated = translateStream('responses', 'gemini', streamOf(events));

  if ('outcome' in translated) throw new Error('expected stream');

  const output: GeminiResponse[] = [];

  for await (const event of translated.stream) output.push(event);

  return output;
}

function imageParts(events: readonly GeminiResponse[]) {
  return events
    .flatMap((event) => event.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => part.inlineData !== undefined);
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
