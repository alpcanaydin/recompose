import { describe, expect, it } from 'vitest';

import type { ChatStreamFrame } from './chat-completions-wire';
import type { ResponsesResponse, ResponsesStreamEvent } from './responses-wire';

import { translateResponse, translateStream } from './dispatcher';

describe('Codex terminal responses crossing Chat', () => {
  it('TestConvertCodexResponseToOpenAI_IncompleteTerminal', async () => {
    const response: ResponsesResponse = {
      id: 'resp_1',
      model: 'gpt-5.5',
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [],
      usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
    };
    const frames = await streamed([{ type: 'response.incomplete', response }]);
    const translated = translateResponse('responses', 'chat-completions', response);

    if ('outcome' in translated || 'refusal' in translated) throw new Error('expected response');

    expect(choices(frames).at(-1)).toMatchObject({
      finish_reason: 'length',
      native_finish_reason: 'max_output_tokens',
    });
    expect(translated.value.choices[0]?.finish_reason).toBe('length');
  });

  it('TestConvertCodexResponseToOpenAI_StreamSetsModelFromResponseCreated', async () => {
    const frames = await streamed([
      {
        type: 'response.created',
        response: { id: 'resp_123', model: 'gpt-5.3-codex', status: 'in_progress', output: [] },
      },
      { type: 'response.output_text.delta', output_index: 0, delta: 'hello' },
    ]);

    expect(chunkFrames(frames).at(-1)?.chunk.model).toBe('gpt-5.3-codex');
  });
});

describe('Codex multi-message response crossing Chat', () => {
  it('TestConvertCodexResponseToOpenAI_NonStreamMultiMessageEmptyTrailingKeepsContent', () => {
    const translated = translateResponse('responses', 'chat-completions', {
      id: 'resp_1',
      model: 'gpt-5.5',
      status: 'completed',
      output: [
        { type: 'reasoning', summary: [{ type: 'summary_text', text: 'thinking' }] },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'the real answer' }],
        },
        { type: 'reasoning', summary: [{ type: 'summary_text', text: 'thinking again' }] },
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '' }] },
      ],
    });

    if ('outcome' in translated || 'refusal' in translated) throw new Error('expected response');

    expect(translated.value.choices[0]?.message.content).toBe('the real answer');
  });
});

async function streamed(events: readonly ResponsesStreamEvent[]): Promise<ChatStreamFrame[]> {
  const result = translateStream('responses', 'chat-completions', streamOf(events));

  if ('outcome' in result) throw new Error('expected stream');
  const frames: ChatStreamFrame[] = [];

  for await (const frame of result.stream) frames.push(frame);

  return frames;
}

function chunkFrames(frames: readonly ChatStreamFrame[]) {
  return frames.filter(
    (frame): frame is Extract<ChatStreamFrame, { type: 'chunk' }> => frame.type === 'chunk',
  );
}

function choices(frames: readonly ChatStreamFrame[]) {
  return chunkFrames(frames).flatMap((frame) => frame.chunk.choices);
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
