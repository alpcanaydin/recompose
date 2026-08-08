import { describe, expect, it } from 'vitest';

import type { ChatStreamFrame } from './chat-completions-wire';
import type { InteractionsStreamEvent } from './interactions-wire';

import { translateResponse, translateStream } from './dispatcher';

describe('Chat answers crossing Interactions', () => {
  it('should preserve a non-stream function call and its identity', () => {
    const translated = translateResponse('chat-completions', 'interactions', {
      id: 'chatcmpl_1',
      model: 'gpt-test',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'lookup', arguments: '{"q":"x"}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    });

    if ('outcome' in translated || 'refusal' in translated) {
      throw new Error('expected translated response');
    }

    expect(translated.value.steps).toContainEqual({
      type: 'function_call',
      id: 'call_1',
      call_id: 'call_1',
      name: 'lookup',
      arguments: { q: 'x' },
    });
  });
});

describe('Interactions answers crossing Chat', () => {
  it('should preserve a non-stream function call and tool finish reason', () => {
    const translated = translateResponse('interactions', 'chat-completions', {
      id: 'i1',
      model: 'gpt-test',
      status: 'requires_action',
      steps: [{ type: 'function_call', id: 'call_1', name: 'lookup', arguments: { q: 'x' } }],
      usage: { total_input_tokens: 2, total_output_tokens: 3, total_tokens: 5 },
    });

    if ('outcome' in translated || 'refusal' in translated) {
      throw new Error('expected translated response');
    }

    expect(translated.value.choices[0]).toMatchObject({
      finish_reason: 'tool_calls',
      message: {
        tool_calls: [
          {
            id: 'call_1',
            function: { name: 'lookup', arguments: '{"q":"x"}' },
          },
        ],
      },
    });
  });
});

describe('Chat streams crossing Interactions', () => {
  it('should preserve chunk identity and terminal usage', async () => {
    const frames: readonly ChatStreamFrame[] = [
      {
        type: 'chunk',
        chunk: {
          id: 'chatcmpl_1',
          model: 'gpt-test',
          choices: [{ index: 0, delta: { content: 'hi' }, finish_reason: null }],
        },
      },
      {
        type: 'chunk',
        chunk: { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
      },
      {
        type: 'chunk',
        chunk: {
          choices: [],
          usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
        },
      },
      { type: 'done' },
    ];

    const events = await chatToInteractions(frames);

    expect(events[0]).toHaveProperty('interaction', {
      id: 'chatcmpl_1',
      model: 'gpt-test',
      status: 'created',
    });
    const completed = events.find((event) => event.event_type === 'interaction.completed');

    expect(completed).toHaveProperty('interaction.usage.total_tokens', 7);
  });
});

describe('Interactions streams crossing Chat', () => {
  it('should preserve cache, reasoning, and total usage in the finish chunk', async () => {
    const source: readonly InteractionsStreamEvent[] = [
      {
        event_type: 'interaction.completed',
        interaction: {
          id: 'i1',
          status: 'completed',
          usage: {
            total_input_tokens: 2,
            total_output_tokens: 6,
            total_cached_tokens: 1,
            total_thought_tokens: 3,
            total_tokens: 8,
          },
        },
      },
      { event_type: 'done' },
    ];

    const frames = await interactionsToChat(source);
    const usage = frames
      .flatMap((frame) => (frame.type === 'chunk' && frame.chunk.usage ? [frame.chunk.usage] : []))
      .at(0);

    expect(usage).toMatchObject({
      prompt_tokens: 2,
      completion_tokens: 6,
      total_tokens: 8,
      prompt_tokens_details: { cached_tokens: 1 },
      completion_tokens_details: { reasoning_tokens: 3 },
    });
  });
});

async function chatToInteractions(source: readonly ChatStreamFrame[]) {
  const translated = translateStream('chat-completions', 'interactions', streamOf(source));

  if ('outcome' in translated) throw new Error('expected translated stream');

  const events = [];

  for await (const event of translated.stream) events.push(event);

  return events;
}

async function interactionsToChat(source: readonly InteractionsStreamEvent[]) {
  const translated = translateStream('interactions', 'chat-completions', streamOf(source));

  if ('outcome' in translated) throw new Error('expected translated stream');

  const frames = [];

  for await (const frame of translated.stream) frames.push(frame);

  return frames;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
