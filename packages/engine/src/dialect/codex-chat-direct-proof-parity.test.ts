import { describe, expect, it } from 'vitest';

import type {
  ChatCompletionsRequest,
  ChatStreamFrame,
  ChatToolMessage,
} from './chat-completions-wire';
import type { ResponsesRequest, ResponsesStreamEvent } from './responses-wire';

import { translateRequest, translateStream } from './dispatcher';

describe('Codex Chat request direct proofs', () => {
  it.each([
    ['plain text', 'plain output'],
    ['JSON object', '{"status":"ok"}'],
    ['text-only array', '[{"type":"input_text","text":"still text"}]'],
    ['invalid image array', '[{"type":"input_image","detail":"low"}]'],
  ])('TestToolCallOutputKeepsNonImageStrings: %s', (_label, content) => {
    expect(toolOutput(content)).toBe(content);
  });
});

describe('Codex multiple tool calls crossing Chat requests', () => {
  it('TestConvertOpenAIRequestToCodexPreservesInputAudio', () => {
    const value = translated({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe this audio verbatim.' },
            { type: 'input_audio', input_audio: { data: 'SUQzBA==', format: 'mp3' } },
          ],
        },
      ],
    });

    expect(value).toHaveProperty('input.0.content', [
      { type: 'input_text', text: 'Transcribe this audio verbatim.' },
      { type: 'input_audio', input_audio: { data: 'SUQzBA==', format: 'mp3' } },
    ]);
  });
});

describe('Codex multi-turn tool calls crossing Chat requests', () => {
  it('TestMultipleToolCalls', () => {
    const value = translated(
      toolHistory([
        ['call_paris', 'Paris', 'sunny'],
        ['call_london', 'London', 'cloudy'],
        ['call_tokyo', 'Tokyo', 'humid'],
      ]),
    );

    expect(value.input.map((item) => item.type)).toEqual([
      'message',
      'function_call',
      'function_call',
      'function_call',
      'function_call_output',
      'function_call_output',
      'function_call_output',
    ]);
  });
});

describe('Codex multi-turn tool history crossing Chat requests', () => {
  it('TestMultiTurnToolCalling', () => {
    const value = translated({
      messages: [
        { role: 'user', content: 'first' },
        assistantCall('call_1', 'lookup', '{}'),
        toolMessage('call_1', 'one'),
        { role: 'assistant', content: 'continue' },
        assistantCall('call_2', 'lookup', '{}'),
        toolMessage('call_2', 'two'),
      ],
    });

    expect(value.input.filter((item) => item.type === 'function_call')).toHaveLength(2);
    expect(value.input.filter((item) => item.type === 'function_call_output')).toHaveLength(2);
  });
});

describe('Codex reused tool IDs crossing Chat requests', () => {
  it('TestToolCallHistoryAllowsReusedCallIDAcrossRounds', () => {
    const value = translated({
      messages: [
        assistantCall('call_reused', 'lookup', '{}'),
        toolMessage('call_reused', 'found'),
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'call_reused', type: 'custom', custom: { name: 'apply_patch', input: 'patch' } },
          ],
        },
        toolMessage('call_reused', 'patched'),
      ],
    });

    expect(value.input.map((item) => item.type)).toEqual([
      'function_call',
      'function_call_output',
      'custom_tool_call',
      'custom_tool_call_output',
    ]);
  });
});

describe('Codex generated image stream direct proofs', () => {
  it('TestConvertCodexResponseToOpenAI_StreamPartialImageEmitsDeltaImages', async () => {
    const event: ResponsesStreamEvent = {
      type: 'response.image_generation_call.partial_image',
      item_id: 'ig_123',
      output_format: 'png',
      partial_image_b64: 'aGVsbG8=',
    };
    const frames = await streamed([event, event]);

    expect(imageUrls(frames)).toEqual(['data:image/png;base64,aGVsbG8=']);
  });

  it('TestConvertCodexResponseToOpenAI_StreamImageGenerationCallDoneEmitsDeltaImages', async () => {
    const frames = await streamed([
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
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          id: 'ig_123',
          type: 'image_generation_call',
          output_format: 'jpeg',
          result: 'Ymll',
        },
      },
    ]);

    expect(imageUrls(frames)).toEqual([
      'data:image/png;base64,aGVsbG8=',
      'data:image/jpeg;base64,Ymll',
    ]);
  });
});

function translated(request: ChatCompletionsRequest): ResponsesRequest {
  const result = translateRequest('chat-completions', 'responses', request);

  if ('outcome' in result || 'refusal' in result) throw new Error('expected request');

  return result.value;
}

function toolOutput(content: ChatToolMessage['content']): unknown {
  const value = translated({
    messages: [assistantCall('call_output', 'inspect', '{}'), toolMessage('call_output', content)],
  });
  const output = value.input.find((item) => item.type === 'function_call_output');

  return output?.output;
}

function assistantCall(
  id: string,
  name: string,
  args: string,
): ChatCompletionsRequest['messages'][number] {
  return {
    role: 'assistant',
    content: null,
    tool_calls: [{ id, type: 'function', function: { name, arguments: args } }],
  };
}

function toolMessage(id: string, content: ChatToolMessage['content']): ChatToolMessage {
  return { role: 'tool', tool_call_id: id, content };
}

function toolHistory(rows: readonly (readonly [string, string, string])[]): ChatCompletionsRequest {
  return {
    messages: [
      { role: 'user', content: 'Compare weather' },
      {
        role: 'assistant',
        content: null,
        tool_calls: rows.map(([id, city]) => ({
          id,
          type: 'function',
          function: { name: 'get_weather', arguments: JSON.stringify({ city }) },
        })),
      },
      ...rows.map(([id, , output]) => toolMessage(id, output)),
    ],
  };
}

async function streamed(events: readonly ResponsesStreamEvent[]): Promise<ChatStreamFrame[]> {
  const result = translateStream('responses', 'chat-completions', streamOf(events));

  if ('outcome' in result) throw new Error('expected stream');
  const frames: ChatStreamFrame[] = [];

  for await (const frame of result.stream) frames.push(frame);

  return frames;
}

function imageUrls(frames: readonly ChatStreamFrame[]): string[] {
  return frames.flatMap((frame) =>
    frame.type === 'chunk'
      ? frame.chunk.choices.flatMap(
          (choice) => choice.delta.images?.map((image) => image.image_url.url) ?? [],
        )
      : [],
  );
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
