import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';
import type { ResponsesKnownStreamEvent } from './responses-wire';

import { decodeKnownResponsesBlockEvent } from './responses-stream-blocks';
import { newResponsesBlockState } from './responses-stream-state';

function decoded(events: readonly ResponsesKnownStreamEvent[]): HubStreamEvent[] {
  const state = newResponsesBlockState();

  return events.flatMap((event) => decodeKnownResponsesBlockEvent(state, event));
}

function unnamedCallAdded(): ResponsesKnownStreamEvent {
  return {
    type: 'response.output_item.added',
    output_index: 0,
    item: { type: 'function_call', call_id: 'call_1' },
  };
}

describe('a Responses delta that arrives before its item was announced', () => {
  it('should open a thinking block for a reasoning summary delta', () => {
    expect(
      decoded([{ type: 'response.reasoning_summary_text.delta', output_index: 0, delta: 'why' }]),
    ).toEqual([
      { type: 'block-open', index: 0, opening: { kind: 'thinking' } },
      { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'why' } },
    ]);
  });

  it('should open a tool block named by the argument delta itself', () => {
    expect(
      decoded([
        {
          type: 'response.function_call_arguments.delta',
          output_index: 0,
          call_id: 'call_1',
          name: 'lookup',
          delta: '{"a"',
        },
      ]),
    ).toEqual([
      { type: 'block-open', index: 0, opening: { kind: 'tool', id: 'call_1', name: 'lookup' } },
      { type: 'block-delta', index: 0, delta: { kind: 'json-args', partialJson: '{"a"' } },
    ]);
  });

  it('should open a nameless tool block when the argument delta names none', () => {
    expect(
      decoded([
        {
          type: 'response.function_call_arguments.delta',
          output_index: 0,
          item_id: 'item_1',
          delta: '{',
        },
      ]),
    ).toContainEqual({
      type: 'block-open',
      index: 0,
      opening: { kind: 'tool', id: 'item_1', name: '' },
    });
  });
});

describe('a Responses tool call announced before its name is known', () => {
  it('should stay silent until the completion names the tool', () => {
    const events = decoded([
      unnamedCallAdded(),
      { type: 'response.function_call_arguments.delta', output_index: 0, delta: '{"city":' },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          type: 'function_call',
          call_id: 'call_1',
          name: 'lookup',
          arguments: '{"city":"Berlin"}',
        },
      },
    ]);

    expect(events).toEqual([
      { type: 'block-open', index: 0, opening: { kind: 'tool', id: 'call_1', name: 'lookup' } },
      {
        type: 'block-delta',
        index: 0,
        delta: { kind: 'json-args', partialJson: '{"city":"Berlin"}' },
      },
      { type: 'block-close', index: 0 },
    ]);
  });

  it('should open a nameless tool block when the completion names none either', () => {
    const events = decoded([
      unnamedCallAdded(),
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: { type: 'function_call', call_id: 'call_1', arguments: '{}' },
      },
    ]);

    expect(events[0]).toEqual({
      type: 'block-open',
      index: 0,
      opening: { kind: 'tool', id: 'call_1', name: '' },
    });
  });
});

describe('a Responses tool call whose completion rewrites its arguments', () => {
  it('should send no argument tail when the completion contradicts what streamed', () => {
    const events = decoded([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'function_call', call_id: 'call_1', name: 'lookup' },
      },
      { type: 'response.function_call_arguments.delta', output_index: 0, delta: '{"city":' },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          type: 'function_call',
          call_id: 'call_1',
          name: 'lookup',
          arguments: '{"town":"Berlin"}',
        },
      },
    ]);

    expect(events.filter((event) => event.type === 'block-delta')).toEqual([
      { type: 'block-delta', index: 0, delta: { kind: 'json-args', partialJson: '{"city":' } },
    ]);
  });
});

describe('a Responses completion the gateway never saw announced', () => {
  it('should ignore an item it cannot open a block for', () => {
    expect(
      decoded([
        {
          type: 'response.output_item.done',
          output_index: 0,
          item: { type: 'image_generation_call', result: 'QUFB' },
        },
      ]),
    ).toEqual([]);
  });

  it('should send no text delta for a message that spells out nothing', () => {
    expect(
      decoded([
        {
          type: 'response.output_item.done',
          output_index: 0,
          item: {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: '' }],
          },
        },
      ]),
    ).toEqual([
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-close', index: 0 },
    ]);
  });

  it('should ignore a known stream event that opens no block at all', () => {
    expect(
      decoded([
        { type: 'response.output_text.done', output_index: 0, content_index: 0, text: 'Hello' },
      ]),
    ).toEqual([]);
  });
});
