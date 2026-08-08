import type { ResponsesToolRef } from './responses-extended-tools';
import type { ResponsesStreamEvent, ResponsesStreamItem } from './responses-wire';

import {
  customToolInput,
  responseToolRef,
  restoreResponsesToolResponse,
} from './responses-tool-restoration';

type ActiveRef = { ref: ResponsesToolRef; arguments: string; itemId?: string };
type RestoreState = { active: Map<number, ActiveRef> };

function restoredItem(
  item: ResponsesStreamItem,
  refs: Readonly<Record<string, ResponsesToolRef>>,
  argumentsJson: string,
): ResponsesStreamItem {
  const ref = toolRef(item, refs);

  if (ref === undefined) return item;

  return restoredRefItem(item, ref, argumentsJson);
}

function toolRef(
  item: ResponsesStreamItem,
  refs: Readonly<Record<string, ResponsesToolRef>>,
): ResponsesToolRef | undefined {
  return responseToolRef(item.name, refs);
}

function restoredRefItem(
  item: ResponsesStreamItem,
  ref: ResponsesToolRef,
  argumentsJson: string,
): ResponsesStreamItem {
  if (ref.kind === 'namespace') return { ...item, name: ref.name, namespace: ref.namespace };

  const { arguments: _arguments, ...rest } = item;

  return {
    ...rest,
    type: 'custom_tool_call',
    id: `ctc_${item.call_id ?? item.id ?? ''}`,
    name: ref.name,
    input: customToolInput(argumentsJson),
  };
}

function addedEvent(
  state: RestoreState,
  event: Extract<ResponsesStreamEvent, { type: 'response.output_item.added' }>,
  refs: Readonly<Record<string, ResponsesToolRef>>,
): ResponsesStreamEvent {
  const ref = responseToolRef(event.item.name, refs);

  if (ref !== undefined) {
    state.active.set(event.output_index, {
      ref,
      arguments: '',
      ...activeItemId(ref, event.item),
    });
  }

  return { ...event, item: restoredItem(event.item, refs, '') };
}

function activeItemId(ref: ResponsesToolRef, item: ResponsesStreamItem): { itemId?: string } {
  if (ref.kind === 'custom') return { itemId: `ctc_${item.call_id ?? item.id ?? ''}` };

  return item.id === undefined ? {} : { itemId: item.id };
}

function argumentDelta(
  state: RestoreState,
  event: Extract<ResponsesStreamEvent, { type: 'response.function_call_arguments.delta' }>,
): ResponsesStreamEvent[] {
  const active = state.active.get(event.output_index);

  if (active?.ref.kind !== 'custom') return [event];

  active.arguments += event.delta;

  return [];
}

function argumentDone(
  state: RestoreState,
  event: Extract<ResponsesStreamEvent, { type: 'response.function_call_arguments.done' }>,
): ResponsesStreamEvent[] {
  const active = state.active.get(event.output_index);

  if (active?.ref.kind !== 'custom') return [event];

  active.arguments = event.arguments;

  return [
    {
      type: 'response.custom_tool_call_input.done',
      output_index: event.output_index,
      ...(active.itemId === undefined ? {} : { item_id: active.itemId }),
      input: customToolInput(event.arguments),
    },
  ];
}

function doneEvent(
  state: RestoreState,
  event: Extract<ResponsesStreamEvent, { type: 'response.output_item.done' }>,
  refs: Readonly<Record<string, ResponsesToolRef>>,
): ResponsesStreamEvent {
  const active = state.active.get(event.output_index);
  const item = event.item;

  state.active.delete(event.output_index);

  return item === undefined
    ? event
    : { ...event, item: restoredItem(item, refs, active?.arguments ?? item.arguments ?? '') };
}

function restoredEvents(
  state: RestoreState,
  event: ResponsesStreamEvent,
  refs: Readonly<Record<string, ResponsesToolRef>>,
): ResponsesStreamEvent[] {
  if (isCompleted(event)) {
    return [{ ...event, response: restoreResponsesToolResponse(event.response, refs) }];
  }

  return restoredActiveEvents(state, event, refs);
}

function restoredActiveEvents(
  state: RestoreState,
  event: ResponsesStreamEvent,
  refs: Readonly<Record<string, ResponsesToolRef>>,
): ResponsesStreamEvent[] {
  if (isAdded(event)) return [addedEvent(state, event, refs)];
  if (isArgumentsDelta(event)) return argumentDelta(state, event);
  if (isArgumentsDone(event)) return argumentDone(state, event);
  if (isItemDone(event)) return [doneEvent(state, event, refs)];

  return [event];
}

function isAdded(
  event: ResponsesStreamEvent,
): event is Extract<ResponsesStreamEvent, { type: 'response.output_item.added' }> {
  return event.type === 'response.output_item.added' && 'output_index' in event && 'item' in event;
}

function isArgumentsDelta(
  event: ResponsesStreamEvent,
): event is Extract<ResponsesStreamEvent, { type: 'response.function_call_arguments.delta' }> {
  return (
    event.type === 'response.function_call_arguments.delta' &&
    'output_index' in event &&
    'delta' in event
  );
}

function isArgumentsDone(
  event: ResponsesStreamEvent,
): event is Extract<ResponsesStreamEvent, { type: 'response.function_call_arguments.done' }> {
  return (
    event.type === 'response.function_call_arguments.done' &&
    'output_index' in event &&
    'arguments' in event
  );
}

function isItemDone(
  event: ResponsesStreamEvent,
): event is Extract<ResponsesStreamEvent, { type: 'response.output_item.done' }> {
  return event.type === 'response.output_item.done' && 'output_index' in event;
}

function isCompleted(
  event: ResponsesStreamEvent,
): event is Extract<ResponsesStreamEvent, { type: 'response.completed' }> {
  return event.type === 'response.completed' && 'response' in event;
}

export async function* restoreResponsesToolStream(
  source: AsyncIterable<ResponsesStreamEvent>,
  refs: Readonly<Record<string, ResponsesToolRef>>,
): AsyncIterable<ResponsesStreamEvent> {
  const state: RestoreState = { active: new Map() };

  for await (const event of source) yield* restoredEvents(state, event, refs);
}
