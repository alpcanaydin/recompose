import { describe, expect, it } from 'vitest';

import type { ChatStreamFrame } from './chat-completions-wire';
import type { GeminiResponse } from './gemini-wire';

import { translateResponseFromGemini, translateStreamFromGemini } from './gemini-bridge';

describe('Gemini usage crossing Chat Completions', () => {
  it('should include zero completion tokens when candidates tokens are missing', async () => {
    const response: GeminiResponse = {
      usageMetadata: { promptTokenCount: 16, thoughtsTokenCount: 42, totalTokenCount: 58 },
    };
    const nonStream = translateResponseFromGemini('chat-completions', response);
    const stream = await streamed([response]);

    expect(nonStream).toHaveProperty('value.usage.completion_tokens', 0);
    expect(completionTokensOf(stream)).toBe(0);
  });
});

describe('Gemini finish and assistant metadata crossing Chat Completions', () => {
  it('should emit assistant role once and finish tool streams only on the terminal chunk', async () => {
    const native = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
    const frames = await streamed([
      {
        candidates: [
          {
            content: {
              parts: [
                { text: 'hello' },
                { functionCall: { name: 'lookup', args: {} }, thoughtSignature: native },
                { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } },
              ],
            },
          },
        ],
      },
      { candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'STOP' }] },
    ]);
    const choices = frames.flatMap((frame) => (frame.type === 'chunk' ? frame.chunk.choices : []));

    expect(choices.filter((choice) => choice.delta.role === 'assistant')).toHaveLength(1);
    expect(choices.some((choice) => choice.delta.images?.length === 1)).toBe(true);
    expect(choices.at(-1)).toMatchObject({
      finish_reason: 'tool_calls',
      native_finish_reason: 'stop',
    });
  });

  it('should keep assistant role in a non-stream response', () => {
    const translated = translateResponseFromGemini('chat-completions', {
      candidates: [{ content: { parts: [{ text: 'hello' }] }, finishReason: 'STOP' }],
    });

    expect(translated).toHaveProperty('value.choices.0.message.role', 'assistant');
  });
});

function completionTokensOf(frames: readonly ChatStreamFrame[]): number | undefined {
  for (const frame of frames) {
    if (frame.type === 'chunk' && frame.chunk.usage != null) {
      return frame.chunk.usage.completion_tokens;
    }
  }

  return undefined;
}

async function streamed(source: readonly GeminiResponse[]) {
  const frames: ChatStreamFrame[] = [];

  for await (const frame of translateStreamFromGemini('chat-completions', streamOf(source))) {
    frames.push(frame);
  }

  return frames;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
