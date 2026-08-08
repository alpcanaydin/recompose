import { describe, expect, it } from 'vitest';

import type { AnthropicResponse, AnthropicStreamEvent } from './anthropic-wire';
import type { GeminiRequest, GeminiResponse } from './gemini-wire';

import { translateRequest, translateResponse, translateStream } from './dispatcher';

describe('Gemini tool history crossing Claude', () => {
  it.each([
    ['id', { id: 'call_gateway_id' }, { id: 'call_gateway_id' }],
    ['call_id', { call_id: 'call_gateway_call_id' }, { call_id: 'call_gateway_call_id' }],
  ])('should preserve explicit %s values', (_label, callId, responseId) => {
    const value = translatedRequest({
      contents: [
        {
          role: 'model',
          parts: [{ functionCall: { name: 'lookup', args: { query: 'status' }, ...callId } }],
        },
        {
          role: 'user',
          parts: [
            { functionResponse: { name: 'lookup', response: { result: 'ok' }, ...responseId } },
          ],
        },
      ],
    });

    expect(value.messages[0]).toHaveProperty('content.0.id', Object.values(callId)[0]);
    expect(value.messages[1]).toHaveProperty('content.0.tool_use_id', Object.values(callId)[0]);
  });

  it('should group consecutive model and user turns', () => {
    const value = translatedRequest({
      contents: [
        { role: 'model', parts: [{ text: 'answer' }] },
        { role: 'model', parts: [{ functionCall: { name: 'first', id: 'call_1', args: {} } }] },
        { role: 'model', parts: [{ functionCall: { name: 'second', id: 'call_2', args: {} } }] },
        { role: 'user', parts: [{ functionResponse: response('first', 'call_1', 'one') }] },
        { role: 'user', parts: [{ functionResponse: response('second', 'call_2', 'two') }] },
      ],
    });

    expect(value.messages.map((message) => message.role)).toEqual(['assistant', 'user']);
    expect(value.messages[0]).toHaveProperty(
      'content',
      expect.arrayContaining([
        expect.objectContaining({ type: 'text' }),
        expect.objectContaining({ type: 'tool_use', id: 'call_1' }),
        expect.objectContaining({ type: 'tool_use', id: 'call_2' }),
      ]),
    );
  });
});

describe('Gemini request controls crossing Claude', () => {
  it('should keep systemInstruction as a separate leading user turn', () => {
    const value = translatedRequest({
      systemInstruction: { parts: [{ text: 'system rule' }] },
      contents: [{ role: 'user', parts: [{ text: 'question' }] }],
    });

    expect(value.system).toBeUndefined();
    expect(value.messages).toHaveLength(2);
    expect(value.messages[0]).toHaveProperty('content.0.text', 'system rule');
    expect(value.messages[1]).toHaveProperty('content.0.text', 'question');
  });

  it('should drop temperature while preserving topP', () => {
    const value = translatedRequest({
      generationConfig: { temperature: 0.2, topP: 0.8 },
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    });

    expect(value.temperature).toBeUndefined();
    expect(value.top_p).toBe(0.8);
  });
});

describe('Gemini media crossing Claude', () => {
  it('should accept camelCase inline image data', () => {
    const value = translatedRequest({
      contents: [
        { role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } }] },
      ],
    });

    expect(value.messages[0]).toHaveProperty('content.0', {
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' },
    });
  });

  it('should use text fallbacks for audio and video but retain a document', () => {
    const value = translatedRequest({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'audio/wav', data: 'UklGRg==' } },
            { inlineData: { mimeType: 'video/mp4', data: 'AAAAIGZ0eXA=' } },
            { inlineData: { mimeType: 'application/pdf', data: 'JVBERi0=' } },
          ],
        },
      ],
    });

    expect(value.messages[0]).toHaveProperty('content.0.type', 'text');
    expect(value.messages[0]).toHaveProperty('content.1.type', 'text');
    expect(value.messages[0]).toHaveProperty('content.2.type', 'document');
  });
});

describe('Claude tool calls crossing Gemini responses', () => {
  it('should preserve a non-stream tool-use ID', () => {
    const translated = translateResponse('anthropic', 'gemini', anthropicToolResponse());

    if ('outcome' in translated || 'refusal' in translated) throw new Error('expected response');

    expect(translated.value).toHaveProperty(
      'candidates.0.content.parts.0.functionCall.id',
      'toolu_gateway',
    );
  });

  it('should preserve a streamed tool-use ID', async () => {
    const translated = translateStream('anthropic', 'gemini', streamOf(anthropicToolStream()));

    if ('outcome' in translated) throw new Error('expected stream');

    const events: GeminiResponse[] = [];

    for await (const event of translated.stream) events.push(event);

    expect(events).toContainEqual(
      expect.objectContaining({
        candidates: [
          expect.objectContaining({
            content: {
              role: 'model',
              parts: [
                {
                  functionCall: {
                    id: 'toolu_gateway',
                    name: 'lookup',
                    args: { query: 'status' },
                  },
                },
              ],
            },
          }),
        ],
      }),
    );
  });
});

function translatedRequest(body: GeminiRequest) {
  const translated = translateRequest('gemini', 'anthropic', body);

  if ('outcome' in translated || 'refusal' in translated) throw new Error('expected request');

  return translated.value;
}

function response(name: string, id: string, result: string) {
  return { name, id, response: { result } };
}

function anthropicToolResponse(): AnthropicResponse {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    content: [
      { type: 'tool_use', id: 'toolu_gateway', name: 'lookup', input: { query: 'status' } },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

function anthropicToolStream(): readonly AnthropicStreamEvent[] {
  return [
    {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'tool_use', id: 'toolu_gateway', name: 'lookup', input: {} },
    },
    {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'input_json_delta', partial_json: '{"query":"status"}' },
    },
    { type: 'content_block_stop', index: 0 },
  ];
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
