import type { HubStreamEvent } from './hub';
import type { ResponsesBlockState } from './responses-stream-state';
import type {
  ResponsesOutputItem,
  ResponsesStreamItem,
  ResponsesStreamResponse,
} from './responses-wire';

import {
  argumentCompletion,
  blockOpenOf,
  pendingDoneEvents,
  signatureCompletion,
} from './responses-stream-blocks';

function terminalItemEvents(
  state: ResponsesBlockState,
  item: ResponsesOutputItem,
  index: number,
): HubStreamEvent[] {
  const streamItem: ResponsesStreamItem = item;

  if (state.closed.has(index)) return [];
  if (state.pending.has(index)) return pendingDoneEvents(state, index, streamItem);
  if (!state.open.has(index)) return completeOutputItemEvents(index, item);

  state.open.delete(index);
  state.closed.add(index);

  return [
    ...argumentCompletion(state, index, item.type === 'function_call' ? item.arguments : undefined),
    ...signatureCompletion(index, streamItem),
    { type: 'block-close', index },
  ];
}

function completeOutputItemEvents(index: number, item: ResponsesOutputItem): HubStreamEvent[] {
  const open = blockOpenOf(index, item);

  if (open === undefined) return [];

  return [
    open,
    ...completeContentDeltas(index, item),
    ...completeArgumentDelta(index, item),
    ...signatureCompletion(index, item),
    { type: 'block-close', index },
  ];
}

function completeContentDeltas(index: number, item: ResponsesOutputItem): HubStreamEvent[] {
  if (item.type === 'message') {
    return item.content.map((part) => ({
      type: 'block-delta',
      index,
      delta: { kind: 'text', text: part.text },
    }));
  }

  if (item.type !== 'reasoning') return [];

  return (item.summary ?? []).map((part) => ({
    type: 'block-delta',
    index,
    delta: { kind: 'thinking', text: part.text },
  }));
}

function completeArgumentDelta(index: number, item: ResponsesOutputItem): HubStreamEvent[] {
  return item.type === 'function_call'
    ? [{ type: 'block-delta', index, delta: { kind: 'json-args', partialJson: item.arguments } }]
    : [];
}

function closeRemaining(state: ResponsesBlockState): HubStreamEvent[] {
  const remaining = [...state.open].toSorted((left, right) => left - right);

  state.open.clear();
  state.pending.clear();
  for (const index of remaining) state.closed.add(index);

  return remaining.map((index) => ({ type: 'block-close', index }));
}

export function hydrateResponsesBlocksAtTerminal(
  state: ResponsesBlockState,
  response: ResponsesStreamResponse,
): HubStreamEvent[] {
  const hydrated = response.output.flatMap((item, index) => terminalItemEvents(state, item, index));

  return [...hydrated, ...closeRemaining(state)];
}
