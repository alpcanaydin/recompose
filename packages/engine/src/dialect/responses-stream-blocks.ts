import type { HubStreamEvent } from './hub';
import type { ResponsesBlockEvent } from './responses-stream-events';
import type { ResponsesBlockState } from './responses-stream-state';
import type { ResponsesKnownStreamEvent, ResponsesStreamItem } from './responses-wire';

import { isResponsesBlockEvent } from './responses-stream-events';
import { webSearchDoneEvents, webSearchOpening } from './responses-stream-web-search';
import { responsesIdentifier, sanitizeToolId } from './tool-id';

function synthesizedToolId(
  item: { id?: string | undefined; call_id?: string | undefined },
  index: number,
): string {
  return responsesIdentifier(
    sanitizeToolId(item.call_id ?? item.id ?? `toolu_stream_${String(index)}`),
  );
}

export function blockOpenOf(index: number, item: ResponsesStreamItem): HubStreamEvent | undefined {
  const webSearch = webSearchOpening(index, item);

  return webSearch ?? standardBlockOpenOf(index, item);
}

function standardBlockOpenOf(index: number, item: ResponsesStreamItem): HubStreamEvent | undefined {
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

type ResponsesDeltaEvent = Exclude<
  ResponsesBlockEvent,
  { type: 'response.output_item.added' | 'response.output_item.done' }
>;

function deltaOpening(event: ResponsesDeltaEvent): HubStreamEvent {
  switch (event.type) {
    case 'response.output_text.delta':
      return { type: 'block-open', index: event.output_index, opening: { kind: 'text' } };
    case 'response.reasoning_summary_text.delta':
      return { type: 'block-open', index: event.output_index, opening: { kind: 'thinking' } };
    case 'response.function_call_arguments.delta':
      return toolDeltaOpening(event);

    default: {
      const unhandled: never = event;

      throw new Error(`unhandled Responses delta: ${JSON.stringify(unhandled)}`);
    }
  }
}

function toolDeltaOpening(
  event: Extract<ResponsesDeltaEvent, { type: 'response.function_call_arguments.delta' }>,
): HubStreamEvent {
  return {
    type: 'block-open',
    index: event.output_index,
    opening: {
      kind: 'tool',
      id: synthesizedToolId({ id: event.item_id, call_id: event.call_id }, event.output_index),
      name: event.name ?? '',
    },
  };
}

function openForDelta(state: ResponsesBlockState, event: ResponsesDeltaEvent): HubStreamEvent[] {
  const index = event.output_index;

  if (state.open.has(index) || state.pending.has(index) || state.closed.has(index)) return [];

  state.open.add(index);

  return [deltaOpening(event)];
}

function decodedDelta(state: ResponsesBlockState, event: ResponsesDeltaEvent): HubStreamEvent[] {
  const opened = openForDelta(state, event);

  if (event.type === 'response.output_text.delta') {
    return [
      ...opened,
      {
        type: 'block-delta',
        index: event.output_index,
        delta: { kind: 'text', text: event.delta },
      },
    ];
  }

  if (event.type === 'response.reasoning_summary_text.delta') {
    return [
      ...opened,
      {
        type: 'block-delta',
        index: event.output_index,
        delta: { kind: 'thinking', text: event.delta },
      },
    ];
  }

  return [...opened, ...argumentDelta(state, event.output_index, event.delta)];
}

function missingArgumentSuffix(current: string, complete: string): string {
  return complete.startsWith(current) ? complete.slice(current.length) : '';
}

export function argumentCompletion(
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

export function signatureCompletion(
  index: number,
  item: ResponsesStreamItem | undefined,
): HubStreamEvent[] {
  const signature = item?.encrypted_content;

  return item?.type === 'reasoning' && signature !== undefined
    ? [{ type: 'block-delta', index, delta: { kind: 'signature', signature } }]
    : [];
}

export function pendingDoneEvents(
  state: ResponsesBlockState,
  index: number,
  item: ResponsesStreamItem,
): HubStreamEvent[] {
  const open = blockOpenOf(index, item);

  if (open === undefined) return [];

  state.pending.delete(index);
  state.arguments.delete(index);
  state.closed.add(index);

  return [
    open,
    ...contentCompletion(index, item),
    ...argumentCompletion(state, index, item.arguments),
    ...signatureCompletion(index, item),
    { type: 'block-close', index },
  ];
}

function contentCompletion(index: number, item: ResponsesStreamItem): HubStreamEvent[] {
  if (item.type !== 'message' || item.content === undefined || item.content === null) return [];

  const text = item.content.map((part) => part.text).join('');

  return text === '' ? [] : [{ type: 'block-delta', index, delta: { kind: 'text', text } }];
}

function doneEvent(
  state: ResponsesBlockState,
  event: Extract<ResponsesBlockEvent, { type: 'response.output_item.done' }>,
): HubStreamEvent[] {
  const pending = state.pending.get(event.output_index);
  const item = event.item === undefined ? pending : { ...pending, ...event.item };

  const webSearch =
    item === undefined ? null : webSearchDoneEvents(state, event.output_index, item);

  if (webSearch !== null) return webSearch;

  return standardDoneEvent(state, event, item, pending);
}

function standardDoneEvent(
  state: ResponsesBlockState,
  event: Extract<ResponsesBlockEvent, { type: 'response.output_item.done' }>,
  item: ResponsesStreamItem | undefined,
  pending: ResponsesStreamItem | undefined,
): HubStreamEvent[] {
  const synthesized = synthesizedDoneEvents(state, event.output_index, item, pending);

  if (synthesized !== null) return synthesized;

  state.open.delete(event.output_index);
  state.closed.add(event.output_index);

  return [
    ...argumentCompletion(state, event.output_index, event.item?.arguments),
    ...signatureCompletion(event.output_index, event.item),
    { type: 'block-close', index: event.output_index },
  ];
}

function synthesizedDoneEvents(
  state: ResponsesBlockState,
  index: number,
  item: ResponsesStreamItem | undefined,
  pending: ResponsesStreamItem | undefined,
): HubStreamEvent[] | null {
  if (item === undefined) return null;

  return pending !== undefined || !state.open.has(index)
    ? pendingDoneEvents(state, index, item)
    : null;
}

function decodeResponsesBlockEvent(
  state: ResponsesBlockState,
  event: ResponsesBlockEvent,
): HubStreamEvent[] {
  if (event.type === 'response.output_item.added') return addedEvent(state, event);
  if (state.skipped.has(event.output_index)) return [];
  if (event.type === 'response.output_item.done') return doneEvent(state, event);

  return decodedDelta(state, event);
}

export function decodeKnownResponsesBlockEvent(
  state: ResponsesBlockState,
  event: ResponsesKnownStreamEvent,
): HubStreamEvent[] {
  return isResponsesBlockEvent(event) ? decodeResponsesBlockEvent(state, event) : [];
}
