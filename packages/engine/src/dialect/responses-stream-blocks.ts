import type { HubStreamEvent } from './hub';
import type {
  ResponsesKnownStreamEvent,
  ResponsesOutputItem,
  ResponsesStreamItem,
  ResponsesStreamResponse,
} from './responses-wire';

import { sanitizeToolId } from './tool-id';

type ResponsesBlockEvent = Extract<
  ResponsesKnownStreamEvent,
  {
    type:
      | 'response.output_item.added'
      | 'response.output_text.delta'
      | 'response.reasoning_summary_text.delta'
      | 'response.function_call_arguments.delta'
      | 'response.output_item.done';
  }
>;

export type ResponsesBlockState = {
  skipped: Set<number>;
  open: Set<number>;
  pending: Map<number, ResponsesStreamItem>;
  arguments: Map<number, string>;
};

export function newResponsesBlockState(): ResponsesBlockState {
  return { skipped: new Set(), open: new Set(), pending: new Map(), arguments: new Map() };
}

function synthesizedToolId(item: { id?: string; call_id?: string }, index: number): string {
  return sanitizeToolId(item.call_id ?? item.id ?? `toolu_stream_${String(index)}`);
}

function blockOpenOf(index: number, item: ResponsesStreamItem): HubStreamEvent | undefined {
  switch (item.type) {
    case 'message':
      return { type: 'block-open', index, opening: { kind: 'text' } };
    case 'function_call':
      return {
        type: 'block-open',
        index,
        opening: { kind: 'tool', id: synthesizedToolId(item, index), name: item.name ?? '' },
      };
    case 'reasoning':
      return { type: 'block-open', index, opening: { kind: 'thinking' } };
    default:
      return undefined;
  }
}

function unnamedFunctionCall(item: ResponsesStreamItem): boolean {
  return item.type === 'function_call' && (item.name === undefined || item.name === '');
}

function addedEvent(
  state: ResponsesBlockState,
  event: Extract<ResponsesBlockEvent, { type: 'response.output_item.added' }>,
): HubStreamEvent[] {
  if (unnamedFunctionCall(event.item)) {
    state.pending.set(event.output_index, event.item);

    return [];
  }

  const open = blockOpenOf(event.output_index, event.item);

  if (open === undefined) {
    state.skipped.add(event.output_index);

    return [];
  }

  state.open.add(event.output_index);

  return [open];
}

function argumentDelta(state: ResponsesBlockState, index: number, delta: string): HubStreamEvent[] {
  const current = state.arguments.get(index) ?? '';

  state.arguments.set(index, current + delta);

  return state.pending.has(index)
    ? []
    : [{ type: 'block-delta', index, delta: { kind: 'json-args', partialJson: delta } }];
}

function decodedDelta(
  state: ResponsesBlockState,
  event: Exclude<
    ResponsesBlockEvent,
    { type: 'response.output_item.added' | 'response.output_item.done' }
  >,
): HubStreamEvent[] {
  if (event.type === 'response.output_text.delta') {
    return [
      {
        type: 'block-delta',
        index: event.output_index,
        delta: { kind: 'text', text: event.delta },
      },
    ];
  }

  if (event.type === 'response.reasoning_summary_text.delta') {
    return [
      {
        type: 'block-delta',
        index: event.output_index,
        delta: { kind: 'thinking', text: event.delta },
      },
    ];
  }

  return argumentDelta(state, event.output_index, event.delta);
}

function missingArgumentSuffix(current: string, complete: string): string {
  return complete.startsWith(current) ? complete.slice(current.length) : '';
}

function argumentCompletion(
  state: ResponsesBlockState,
  index: number,
  complete: string | undefined,
): HubStreamEvent[] {
  if (complete === undefined) return [];

  const current = state.arguments.get(index) ?? '';
  const suffix = missingArgumentSuffix(current, complete);

  state.arguments.set(index, complete);

  return suffix === ''
    ? []
    : [{ type: 'block-delta', index, delta: { kind: 'json-args', partialJson: suffix } }];
}

function signatureCompletion(
  index: number,
  item: ResponsesStreamItem | undefined,
): HubStreamEvent[] {
  const signature = item?.encrypted_content;

  return item?.type === 'reasoning' && signature !== undefined
    ? [{ type: 'block-delta', index, delta: { kind: 'signature', signature } }]
    : [];
}

function pendingDoneEvents(
  state: ResponsesBlockState,
  index: number,
  item: ResponsesStreamItem,
): HubStreamEvent[] {
  const open = blockOpenOf(index, item);

  if (open === undefined) return [];

  state.pending.delete(index);
  state.arguments.delete(index);

  return [
    open,
    ...argumentCompletion(state, index, item.arguments),
    ...signatureCompletion(index, item),
    { type: 'block-close', index },
  ];
}

function doneEvent(
  state: ResponsesBlockState,
  event: Extract<ResponsesBlockEvent, { type: 'response.output_item.done' }>,
): HubStreamEvent[] {
  const pending = state.pending.get(event.output_index);
  const item = event.item === undefined ? pending : { ...pending, ...event.item };

  if (item !== undefined && pending !== undefined) {
    return pendingDoneEvents(state, event.output_index, item);
  }

  state.open.delete(event.output_index);

  return [
    ...argumentCompletion(state, event.output_index, event.item?.arguments),
    ...signatureCompletion(event.output_index, event.item),
    { type: 'block-close', index: event.output_index },
  ];
}

export function decodeResponsesBlockEvent(
  state: ResponsesBlockState,
  event: ResponsesBlockEvent,
): HubStreamEvent[] {
  if (event.type === 'response.output_item.added') return addedEvent(state, event);
  if (state.skipped.has(event.output_index)) return [];
  if (event.type === 'response.output_item.done') return doneEvent(state, event);

  return decodedDelta(state, event);
}

function streamItemFromOutput(item: ResponsesOutputItem): ResponsesStreamItem {
  return item;
}

function terminalItemEvents(
  state: ResponsesBlockState,
  item: ResponsesOutputItem,
  index: number,
): HubStreamEvent[] {
  const streamItem = streamItemFromOutput(item);

  if (state.pending.has(index)) return pendingDoneEvents(state, index, streamItem);
  if (!state.open.has(index)) return [];

  state.open.delete(index);

  return [
    ...argumentCompletion(state, index, item.type === 'function_call' ? item.arguments : undefined),
    ...signatureCompletion(index, streamItem),
    { type: 'block-close', index },
  ];
}

function closeRemaining(state: ResponsesBlockState): HubStreamEvent[] {
  const remaining = [...state.open].toSorted((left, right) => left - right);

  state.open.clear();
  state.pending.clear();

  return remaining.map((index) => ({ type: 'block-close', index }));
}

export function hydrateResponsesBlocksAtTerminal(
  state: ResponsesBlockState,
  response: ResponsesStreamResponse,
): HubStreamEvent[] {
  const hydrated = response.output.flatMap((item, index) => terminalItemEvents(state, item, index));

  return [...hydrated, ...closeRemaining(state)];
}
