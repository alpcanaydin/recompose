import { describe, expect, it } from 'vitest';

import type { ChatCompletionsResponse, ChatStreamFrame } from './chat-completions-wire';
import type { GeminiRequest, GeminiResponse } from './gemini-wire';

import { translateRequest, translateResponse, translateStream } from './dispatcher';

describe('Gemini function history crossing Chat Completions', () => {
  it('should consume generated tool call IDs in FIFO order', () => {
    const value = translatedRequest(functionHistory(3, 3));
    const calls = assistantToolCalls(value.messages[0]);
    const responses = value.messages.slice(1).map(toolMessageId);

    expect(new Set(calls.map((call) => call.id))).toHaveProperty('size', 3);
    expect(responses).toEqual(calls.map((call) => call.id));
  });

  it('should synthesize a fallback ID for a response without a prior call', () => {
    const value = translatedRequest(functionHistory(0, 1));

    expect(toolMessageId(value.messages[0])).toMatch(/^call_/u);
  });

  it('should give an extra response a fresh fallback ID', () => {
    const value = translatedRequest(functionHistory(1, 2));
    const call = assistantToolCalls(value.messages[0])[0];
    const first = toolMessageId(value.messages[1]);
    const extra = toolMessageId(value.messages[2]);

    expect(first).toBe(call?.id);
    expect(extra).toMatch(/^call_/u);
    expect(extra).not.toBe(call?.id);
  });
});

describe('Gemini explicit function IDs crossing Chat Completions', () => {
  it.each([
    ['id', { id: 'call_gateway_id' }, { id: 'call_gateway_id' }],
    ['call_id', { call_id: 'call_gateway_call_id' }, { call_id: 'call_gateway_call_id' }],
  ])('should preserve an explicit %s', (_label, callId, responseId) => {
    const value = translatedRequest({
      contents: [
        {
          role: 'model',
          parts: [{ functionCall: { name: 'lookup', args: { q: 'x' }, ...callId } }],
        },
        {
          role: 'function',
          parts: [
            { functionResponse: { name: 'lookup', response: { result: 'ok' }, ...responseId } },
          ],
        },
      ],
    });
    const call = assistantToolCalls(value.messages[0])[0];

    expect(toolMessageId(value.messages[1])).toBe(call?.id);
  });
});

describe('Gemini inline media crossing Chat Completions', () => {
  it('should accept snake_case inline image data', () => {
    const value = translatedRequest({
      contents: [
        {
          role: 'user',
          parts: [{ inline_data: { mime_type: 'image/png', data: 'aGVsbG8=' } }],
        },
      ],
    });

    expect(value.messages[0]).toHaveProperty(
      'content.0.image_url.url',
      'data:image/png;base64,aGVsbG8=',
    );
  });

  it('should split audio, video, and document data by MIME type', () => {
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

    expect(value.messages[0]).toHaveProperty('content.0.type', 'input_audio');
    expect(value.messages[0]).toHaveProperty('content.1.type', 'video_url');
    expect(value.messages[0]).toHaveProperty('content.2.type', 'file');
  });
});

describe('Chat tool calls crossing Gemini responses', () => {
  it('should preserve a non-stream tool call ID and arguments', () => {
    const translated = translateResponse('chat-completions', 'gemini', chatToolResponse());

    if ('outcome' in translated || 'refusal' in translated) throw new Error('expected response');

    expect(translated.value).toHaveProperty('candidates.0.content.parts.0.functionCall', {
      id: 'call_chat_1',
      name: 'lookup',
      args: { q: 'x' },
    });
  });

  it('should preserve a streamed tool call ID and arguments', async () => {
    const translated = translateStream('chat-completions', 'gemini', streamOf(chatToolStream()));

    if ('outcome' in translated) throw new Error('expected stream');

    const events: GeminiResponse[] = [];

    for await (const event of translated.stream) events.push(event);

    expect(events).toContainEqual(
      expect.objectContaining({
        candidates: [
          expect.objectContaining({
            content: {
              role: 'model',
              parts: [{ functionCall: { id: 'call_stream_1', name: 'lookup', args: { q: 'x' } } }],
            },
          }),
        ],
      }),
    );
  });
});

function translatedRequest(body: GeminiRequest) {
  const translated = translateRequest('gemini', 'chat-completions', body);

  if ('outcome' in translated || 'refusal' in translated) throw new Error('expected request');

  return translated.value;
}

function functionHistory(callCount: number, responseCount: number): GeminiRequest {
  const calls = Array.from({ length: callCount }, (_, index) => ({
    functionCall: { name: `tool_${String(index)}`, args: { index } },
  }));
  const responses = Array.from({ length: responseCount }, (_, index) => ({
    functionResponse: {
      name: `tool_${String(Math.min(index, Math.max(0, callCount - 1)))}`,
      response: { result: index },
    },
  }));
  const contents: GeminiRequest['contents'] = [];

  if (calls.length > 0) contents.push({ role: 'model', parts: calls });
  contents.push({ role: 'function', parts: responses });

  return { contents };
}

function assistantToolCalls(
  message: ReturnType<typeof translatedRequest>['messages'][number] | undefined,
) {
  return message?.role === 'assistant' ? (message.tool_calls ?? []) : [];
}

function toolMessageId(
  message: ReturnType<typeof translatedRequest>['messages'][number] | undefined,
) {
  return message?.role === 'tool' ? message.tool_call_id : undefined;
}

function chatToolResponse(): ChatCompletionsResponse {
  return {
    choices: [
      {
        index: 0,
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_chat_1',
              type: 'function',
              function: { name: 'lookup', arguments: '{"q":"x"}' },
            },
          ],
        },
      },
    ],
  };
}

function chatToolStream(): readonly ChatStreamFrame[] {
  return [
    {
      type: 'chunk',
      chunk: {
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_stream_1',
                  function: { name: 'lookup', arguments: '{"q":"x"}' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      type: 'chunk',
      chunk: { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
    },
  ];
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
