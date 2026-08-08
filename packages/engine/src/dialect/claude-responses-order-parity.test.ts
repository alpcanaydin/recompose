import { describe, expect, it } from 'vitest';

import type { AnthropicStreamEvent } from './anthropic-wire';

import { translateResponse, translateStream } from './dispatcher';

describe('Claude non-stream output order crossing Responses', () => {
  it('should preserve reasoning, text, tool, reasoning, and text order', () => {
    const translated = translateResponse('anthropic', 'responses', {
      id: 'msg_1',
      model: 'claude-test',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'first thought', signature: 'sig_1' },
        { type: 'text', text: 'first answer' },
        { type: 'tool_use', id: 'call_1', name: 'lookup', input: { q: 'x' } },
        { type: 'thinking', thinking: 'second thought', signature: 'sig_2' },
        { type: 'text', text: 'second answer' },
      ],
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: 3, output_tokens: 2 },
    });

    if ('outcome' in translated || 'refusal' in translated) {
      throw new Error('expected translated response');
    }

    expect(translated.value.output.map((item) => item.type)).toEqual([
      'reasoning',
      'message',
      'function_call',
      'reasoning',
      'message',
    ]);
    expect(translated.value.id).toBe('msg_1');
    expect(translated.value.model).toBe('claude-test');
  });

  it('should normalize an empty function input to an empty JSON object', () => {
    const translated = translateResponse('anthropic', 'responses', {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'call_1', name: 'lookup', input: {} }],
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    if ('outcome' in translated || 'refusal' in translated) {
      throw new Error('expected translated response');
    }

    expect(translated.value.output[0]).toHaveProperty('arguments', '{}');
  });
});

describe('Claude stream output order crossing Responses', () => {
  it('should emit contiguous output indices for reasoning, text, and tool blocks', async () => {
    const events = await translatedStream([
      messageStart(),
      { type: 'content_block_start', index: 4, content_block: { type: 'thinking', thinking: '' } },
      { type: 'content_block_delta', index: 4, delta: { type: 'thinking_delta', thinking: 'why' } },
      { type: 'content_block_stop', index: 4 },
      { type: 'content_block_start', index: 9, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 9, delta: { type: 'text_delta', text: 'answer' } },
      { type: 'content_block_stop', index: 9 },
      {
        type: 'content_block_start',
        index: 12,
        content_block: { type: 'tool_use', id: 'call_1', name: 'lookup', input: {} },
      },
      { type: 'content_block_stop', index: 12 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'tool_use', stop_sequence: null },
        usage: { output_tokens: 2 },
      },
      { type: 'message_stop' },
    ]);
    const added = events.filter((event) => event.type === 'response.output_item.added');

    expect(added.map((event) => ('output_index' in event ? event.output_index : -1))).toEqual([
      0, 1, 2,
    ]);
  });
});

describe('Claude cache usage crossing Responses', () => {
  it('should include cache creation in input and total tokens', () => {
    const translated = translateResponse('anthropic', 'responses', {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 13,
        output_tokens: 4,
        cache_read_input_tokens: 22000,
        cache_creation_input_tokens: 31,
      },
    });

    if ('outcome' in translated || 'refusal' in translated) {
      throw new Error('expected translated response');
    }

    expect(translated.value.usage).toEqual({
      input_tokens: 22044,
      output_tokens: 4,
      total_tokens: 22048,
      input_tokens_details: { cached_tokens: 22000 },
    });
  });
});

function messageStart(): AnthropicStreamEvent {
  return {
    type: 'message_start',
    message: {
      id: 'msg_1',
      model: 'claude-test',
      type: 'message',
      role: 'assistant',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 3, output_tokens: 0 },
    },
  };
}

async function translatedStream(source: readonly AnthropicStreamEvent[]) {
  const translated = translateStream('anthropic', 'responses', streamOf(source));

  if ('outcome' in translated) throw new Error('expected translated stream');

  const events = [];

  for await (const event of translated.stream) events.push(event);

  return events;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
