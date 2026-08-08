import type {
  ResponsesKnownStreamEvent,
  ResponsesOutputItem,
  ResponsesStreamEvent,
  ResponsesStreamItem,
} from './responses-wire';

type CallState = {
  callId: string;
  index: number;
  inputEmitted: boolean;
  itemId?: string;
  name: string;
};
type State = {
  active?: number;
  calls: Map<number, CallState>;
  itemIndexes: Map<string, number>;
  nextIndex: number;
};
type Added = Extract<ResponsesKnownStreamEvent, { type: 'response.output_item.added' }>;
type Delta = Extract<ResponsesKnownStreamEvent, { type: 'response.custom_tool_call_input.delta' }>;
type InputDone = Extract<
  ResponsesKnownStreamEvent,
  { type: 'response.custom_tool_call_input.done' }
>;
type ItemDone = Extract<ResponsesKnownStreamEvent, { type: 'response.output_item.done' }>;
type Terminal = Extract<
  ResponsesKnownStreamEvent,
  { type: 'response.completed' | 'response.incomplete' | 'response.failed' }
>;

function eventIndex(
  event: { output_index?: number; item_id?: string },
  state: State,
): number | undefined {
  if (typeof event.output_index === 'number') return event.output_index;
  if (typeof event.item_id === 'string') return state.itemIndexes.get(event.item_id);

  return state.active;
}

function functionItem(call: CallState, input = ''): ResponsesStreamItem {
  return {
    type: 'function_call',
    id: call.itemId ?? call.callId,
    call_id: call.callId,
    name: call.name,
    arguments: input,
  };
}

function callState(item: ResponsesStreamItem, index: number): CallState {
  return {
    callId: item.call_id ?? item.id ?? `call_${String(index)}`,
    index,
    inputEmitted: false,
    name: item.name ?? '',
    ...(item.id === undefined ? {} : { itemId: item.id }),
  };
}

function remember(state: State, call: CallState): void {
  state.calls.set(call.index, call);
  state.active = call.index;
  state.nextIndex = Math.max(state.nextIndex, call.index + 1);
  if (call.itemId !== undefined) state.itemIndexes.set(call.itemId, call.index);
}

function added(event: Added, state: State): ResponsesStreamEvent[] | null {
  if (event.item.type !== 'custom_tool_call') return null;

  const call = callState(event.item, event.output_index);

  remember(state, call);

  return [
    {
      type: 'response.output_item.added',
      output_index: event.output_index,
      item: functionItem(call),
    },
  ];
}

function activeCall(
  event: { output_index?: number; item_id?: string },
  state: State,
): CallState | undefined {
  const index = eventIndex(event, state);

  return index === undefined ? undefined : state.calls.get(index);
}

function argumentEvent(call: CallState, delta: string): ResponsesStreamEvent {
  return {
    type: 'response.function_call_arguments.delta',
    output_index: call.index,
    item_id: call.itemId,
    call_id: call.callId,
    name: call.name,
    delta,
  };
}

function customDelta(event: Delta, state: State): ResponsesStreamEvent[] {
  if (event.delta === '') return [];

  const call = activeCall(event, state);

  if (call === undefined) return [];
  call.inputEmitted = true;

  return [argumentEvent(call, event.delta)];
}

function customInputDone(event: InputDone, state: State): ResponsesStreamEvent[] {
  const call = activeCall(event, state);

  if (call === undefined || call.inputEmitted || event.input === '') return [];
  call.inputEmitted = true;

  return [argumentEvent(call, event.input)];
}

function customDone(event: ItemDone, state: State): ResponsesStreamEvent[] | null {
  if (event.item?.type !== 'custom_tool_call') return null;

  const call = state.calls.get(event.output_index) ?? callState(event.item, event.output_index);

  remember(state, call);

  return [
    {
      type: 'response.output_item.done',
      output_index: event.output_index,
      item: functionItem(call, event.item.input ?? ''),
    },
  ];
}

function terminalOutput(state: State): ResponsesOutputItem[] {
  return [...state.calls.values()]
    .toSorted((left, right) => left.index - right.index)
    .map((call) => ({
      type: 'function_call',
      call_id: call.callId,
      name: call.name,
      arguments: '',
    }));
}

function terminal(event: Terminal, state: State): ResponsesStreamEvent[] | null {
  if (event.response.output.length > 0 || state.calls.size === 0) return null;

  return [{ ...event, response: { ...event.response, output: terminalOutput(state) } }];
}

function earlyLifecycle(
  event: ResponsesKnownStreamEvent,
  state: State,
): ResponsesStreamEvent[] | null {
  if (event.type === 'response.output_item.added') return added(event, state);
  if (event.type === 'response.custom_tool_call_input.delta') return customDelta(event, state);
  if (event.type === 'response.custom_tool_call_input.done') return customInputDone(event, state);

  return null;
}

function lateLifecycle(
  event: ResponsesKnownStreamEvent,
  state: State,
): ResponsesStreamEvent[] | null {
  if (event.type === 'response.output_item.done') return customDone(event, state);
  if (
    event.type === 'response.completed' ||
    event.type === 'response.incomplete' ||
    event.type === 'response.failed'
  )
    return terminal(event, state);

  return null;
}

const knownTypes = new Set([
  'response.created',
  'response.output_item.added',
  'response.output_text.delta',
  'response.reasoning_summary_text.delta',
  'response.image_generation_call.partial_image',
  'response.function_call_arguments.delta',
  'response.function_call_arguments.done',
  'response.custom_tool_call_input.delta',
  'response.custom_tool_call_input.done',
  'response.output_text.done',
  'response.content_part.done',
  'response.output_item.done',
  'response.completed',
  'response.incomplete',
  'response.failed',
  'error',
]);

function isKnown(event: ResponsesStreamEvent): event is ResponsesKnownStreamEvent {
  return knownTypes.has(event.type);
}

function normalized(event: ResponsesKnownStreamEvent, state: State): ResponsesStreamEvent[] {
  return earlyLifecycle(event, state) ?? lateLifecycle(event, state) ?? [event];
}

export async function* responsesStreamForChat(
  source: AsyncIterable<ResponsesStreamEvent>,
): AsyncIterable<ResponsesStreamEvent> {
  const state: State = { calls: new Map(), itemIndexes: new Map(), nextIndex: 0 };

  for await (const event of source) yield* isKnown(event) ? normalized(event, state) : [event];
}
