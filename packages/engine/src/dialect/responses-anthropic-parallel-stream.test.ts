import { describe, expect, it } from 'vitest';

import type { AnthropicKnownStreamEvent, AnthropicStreamEvent } from './anthropic-wire';
import type { ResponsesStreamEvent } from './responses-wire';

import { encodeStream as encodeAnthropicStream } from './anthropic-stream';
import { collect, streamOf } from './chat-completions.testkit';
import { decodeStream as decodeResponsesStream } from './responses-stream';

const KNOWN_EVENT_TYPES = new Set([
  'message_start',
  'content_block_start',
  'content_block_delta',
  'content_block_stop',
  'message_delta',
  'message_stop',
  'error',
]);

describe('Responses to Anthropic parallel function-call streaming', () => {
  it.each([
    ['first call finishes first', false],
    ['second call finishes first', true],
  ])('should serialize interleaved calls when %s', async (_name, secondFirst) => {
    const events = await translated(interleavedEvents(secondFirst));

    expect(blockLifecycle(events)).toEqual([
      { index: 0, id: 'call_a', arguments: '{"path":"a"}' },
      { index: 1, id: 'call_b', arguments: '{"path":"b"}' },
    ]);
  });
});

// Helpers

async function translated(
  events: readonly ResponsesStreamEvent[],
): Promise<AnthropicStreamEvent[]> {
  return collect(encodeAnthropicStream(decodeResponsesStream(streamOf(events))));
}

function callDelta(index: number, path: string): ResponsesStreamEvent {
  return {
    type: 'response.function_call_arguments.delta',
    output_index: index,
    delta: `{"path":"${path}"}`,
  };
}

function callDone(index: number): ResponsesStreamEvent {
  return { type: 'response.output_item.done', output_index: index };
}

function interleavedEvents(secondFirst: boolean): ResponsesStreamEvent[] {
  const firstDone = [callDelta(1, 'a'), callDone(1)];
  const secondDone = [callDelta(2, 'b'), callDone(2)];

  return [
    { type: 'response.created', response: { id: 'r', status: 'in_progress', output: [] } },
    {
      type: 'response.output_item.added',
      output_index: 1,
      item: { type: 'function_call', call_id: 'call_a', name: 'Read' },
    },
    {
      type: 'response.output_item.added',
      output_index: 2,
      item: { type: 'function_call', call_id: 'call_b', name: 'Read' },
    },
    ...(secondFirst ? [...secondDone, ...firstDone] : [...firstDone, ...secondDone]),
    { type: 'response.completed', response: { id: 'r', status: 'completed', output: [] } },
  ];
}

type LifecycleState = {
  blocks: Array<{ index: number; id: string; arguments: string }>;
  open: number | undefined;
};

function knownEvents(events: readonly AnthropicStreamEvent[]): AnthropicKnownStreamEvent[] {
  return events.filter((event): event is AnthropicKnownStreamEvent =>
    KNOWN_EVENT_TYPES.has(event.type),
  );
}

function handleStart(
  state: LifecycleState,
  event: Extract<AnthropicKnownStreamEvent, { type: 'content_block_start' }>,
): void {
  expect(state.open).toBeUndefined();
  state.open = event.index;
  state.blocks.push({
    index: event.index,
    id: event.content_block.type === 'tool_use' ? event.content_block.id : '',
    arguments: '',
  });
}

function handleDelta(
  state: LifecycleState,
  event: Extract<AnthropicKnownStreamEvent, { type: 'content_block_delta' }>,
): void {
  expect(event.index).toBe(state.open);
  const block = state.blocks.at(-1);

  if (block !== undefined && event.delta.type === 'input_json_delta') {
    block.arguments += event.delta.partial_json;
  }
}

function handledStart(state: LifecycleState, event: AnthropicKnownStreamEvent): boolean {
  if (event.type !== 'content_block_start') return false;

  handleStart(state, event);

  return true;
}

function handledDelta(state: LifecycleState, event: AnthropicKnownStreamEvent): boolean {
  if (event.type !== 'content_block_delta') return false;

  handleDelta(state, event);

  return true;
}

function handledStop(state: LifecycleState, event: AnthropicKnownStreamEvent): boolean {
  if (event.type !== 'content_block_stop') return false;

  expect(event.index).toBe(state.open);
  state.open = undefined;

  return true;
}

function handleMessageDelta(state: LifecycleState, event: AnthropicKnownStreamEvent): void {
  if (event.type === 'message_delta') expect(state.open).toBeUndefined();
}

function handleLifecycle(state: LifecycleState, event: AnthropicKnownStreamEvent): void {
  if (handledStart(state, event)) return;
  if (handledDelta(state, event)) return;
  if (handledStop(state, event)) return;

  handleMessageDelta(state, event);
}

function blockLifecycle(events: readonly AnthropicStreamEvent[]) {
  const state: LifecycleState = { blocks: [], open: undefined };

  for (const event of knownEvents(events)) handleLifecycle(state, event);

  return state.blocks;
}
