import { describe, expect, it } from 'vitest';

import type { AnthropicStreamEvent } from './anthropic-wire';
import type { ResponsesStreamEvent } from './responses-wire';

import { translateStream } from './dispatcher';

describe('Claude hidden server tools crossing Responses', () => {
  it('should aggregate surrounding text and retain a search annotation', async () => {
    const events = await translate(annotatedSearchStream());
    const added = events.filter((event) => event.type === 'response.output_item.added');
    const done = events.find((event) => event.type === 'response.output_text.done');
    const completed = completedEvent(events);

    expect(added).toHaveLength(1);
    expect(done).toHaveProperty('text', '**Compare**\n- Qwen leads.');
    expect(completed).toHaveProperty(
      'response.output.0.content.0.annotations.0.type',
      'web_search_result_location',
    );
    expect(events.some((event) => event.type === 'response.function_call_arguments.delta')).toBe(
      false,
    );
  });

  it('should not leave output index gaps around a hidden server tool', async () => {
    const events = await translate(hiddenToolBeforeFunctionStream());
    const added = events.filter((event) => event.type === 'response.output_item.added');

    expect(added.map(outputIndexOf)).toEqual([0, 1]);
    expect(completedEvent(events)).toHaveProperty(
      'response.output',
      expect.arrayContaining([
        expect.objectContaining({ type: 'message' }),
        expect.objectContaining({ type: 'function_call' }),
      ]),
    );
  });
});

describe('Claude text and tool boundaries crossing Responses', () => {
  it('should finalize each message on the correct side of a function call', async () => {
    const events = await translate(textToolTextStream());
    const doneTypes = events.filter(isOutputItemDone).map((event) => event.item?.type);

    expect(doneTypes).toEqual(['message', 'function_call', 'message']);
    expect(completedEvent(events)).toHaveProperty(
      'response.output',
      expect.arrayContaining([
        expect.objectContaining({ type: 'message' }),
        expect.objectContaining({ type: 'function_call' }),
      ]),
    );
  });
});

function messageStart(): AnthropicStreamEvent {
  return {
    type: 'message_start',
    message: {
      id: 'msg_123',
      model: 'claude-test',
      type: 'message',
      role: 'assistant',
      content: [],
      stop_reason: null,
      usage: { input_tokens: 1, output_tokens: 0 },
    },
  };
}

function textBlock(index: number, text: string): AnthropicStreamEvent[] {
  return [
    { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index },
  ];
}

function annotatedSearchStream(): readonly AnthropicStreamEvent[] {
  return [
    messageStart(),
    ...textBlock(4, '**Compare**\n- '),
    { type: 'content_block_start', index: 5, content_block: { type: 'server_tool_use' } },
    {
      type: 'content_block_delta',
      index: 5,
      delta: { type: 'input_json_delta', partial_json: '{"query":"Qwen"}' },
    },
    { type: 'content_block_stop', index: 5 },
    { type: 'content_block_start', index: 6, content_block: { type: 'web_search_tool_result' } },
    { type: 'content_block_stop', index: 6 },
    {
      type: 'content_block_delta',
      index: 5,
      delta: {
        type: 'citations_delta',
        citation: { type: 'web_search_result_location', url: 'https://example.com' },
      },
    },
    ...textBlock(7, 'Qwen leads.'),
    { type: 'message_stop' },
  ];
}

function hiddenToolBeforeFunctionStream(): readonly AnthropicStreamEvent[] {
  return [
    messageStart(),
    ...textBlock(0, 'Checking.'),
    { type: 'content_block_start', index: 8, content_block: { type: 'server_tool_use' } },
    { type: 'content_block_stop', index: 8 },
    ...toolBlock(12),
    { type: 'message_stop' },
  ];
}

function textToolTextStream(): readonly AnthropicStreamEvent[] {
  return [
    messageStart(),
    ...textBlock(0, 'Checking.'),
    ...toolBlock(1),
    ...textBlock(2, 'Done.'),
    { type: 'message_stop' },
  ];
}

function toolBlock(index: number): AnthropicStreamEvent[] {
  return [
    {
      type: 'content_block_start',
      index,
      content_block: { type: 'tool_use', id: 'call_1', name: 'exec', input: {} },
    },
    { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: '{}' } },
    { type: 'content_block_stop', index },
  ];
}

async function translate(source: readonly AnthropicStreamEvent[]) {
  const translated = translateStream('anthropic', 'responses', streamOf(source));

  if ('outcome' in translated) throw new Error('expected translated stream');

  const events: ResponsesStreamEvent[] = [];

  for await (const event of translated.stream) events.push(event);

  return events;
}

function completedEvent(events: readonly ResponsesStreamEvent[]) {
  const completed = events.find((event) => event.type === 'response.completed');

  if (completed?.type !== 'response.completed') throw new Error('expected completed response');

  return completed;
}

function outputIndexOf(event: ResponsesStreamEvent): number {
  return 'output_index' in event ? event.output_index : -1;
}

function isOutputItemDone(
  event: ResponsesStreamEvent,
): event is Extract<ResponsesStreamEvent, { type: 'response.output_item.done' }> {
  return event.type === 'response.output_item.done';
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
