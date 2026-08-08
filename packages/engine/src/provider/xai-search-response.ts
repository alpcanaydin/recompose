import type { Crossing, JsonObject } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { transformingSseLines } from '../stream-wire';

const INTERNAL_NAMES = new Set([
  'x_user_search',
  'x_semantic_search',
  'x_keyword_search',
  'x_thread_fetch',
]);

type Ownership = NonNullable<Crossing['xaiSearchOwnership']>;
type State = { droppedIds: Set<string>; droppedIndexes: Set<number> };

function callType(item: JsonObject): string {
  if (item['type'] === 'function_call') return 'function';

  return item['type'] === 'custom_tool_call' ? 'custom' : '';
}

function toolKey(item: JsonObject): string {
  const namespace = typeof item['namespace'] === 'string' ? item['namespace'].trim() : '';
  const name = typeof item['name'] === 'string' ? item['name'].trim() : '';

  return `${callType(item)}\0${namespace}\0${name}`;
}

function internalCall(item: JsonObject, ownership: Ownership): boolean {
  const { callId, name, namespace } = callIdentity(item);

  if (!internalCandidate(item, name, namespace)) return false;
  if (callId.startsWith('xs_call')) return true;

  return !ownership.clientTools.includes(toolKey(item));
}

function callIdentity(item: JsonObject): { callId: string; name: string; namespace: string } {
  return {
    callId: typeof item['call_id'] === 'string' ? item['call_id'] : '',
    name: typeof item['name'] === 'string' ? item['name'].trim() : '',
    namespace: typeof item['namespace'] === 'string' ? item['namespace'].trim() : '',
  };
}

function internalCandidate(item: JsonObject, name: string, namespace: string): boolean {
  return INTERNAL_NAMES.has(name) && callType(item) !== '' && namespace === '';
}

function rememberDropped(event: JsonObject, item: JsonObject, state: State): void {
  if (typeof event['output_index'] === 'number') state.droppedIndexes.add(event['output_index']);

  for (const field of ['id', 'call_id']) {
    const id = item[field];

    if (typeof id === 'string' && id !== '') state.droppedIds.add(id);
  }
}

function referencesDropped(event: JsonObject, state: State): boolean {
  const index = event['output_index'];

  if (typeof index === 'number' && state.droppedIndexes.has(index)) return true;

  return ['item_id', 'call_id'].some((field) => {
    const id = event[field];

    return typeof id === 'string' && state.droppedIds.has(id);
  });
}

function compactIndex(event: JsonObject, state: State): JsonObject {
  const index = event['output_index'];

  if (typeof index !== 'number') return event;
  const before = [...state.droppedIndexes].filter((dropped) => dropped < index).length;

  return before === 0 ? event : { ...event, output_index: index - before };
}

function filteredOutput(value: unknown, ownership: Ownership): unknown {
  return Array.isArray(value)
    ? value.filter((item) => !isJsonObject(item) || !internalCall(item, ownership))
    : value;
}

function filterEvent(event: JsonObject, ownership: Ownership, state: State): JsonObject | null {
  const item = event['item'];

  if (isJsonObject(item) && dropItem(event, item, ownership, state)) return null;

  if (referencesDropped(event, state)) return null;

  return filteredCompletedEvent(event, ownership, state);
}

function dropItem(
  event: JsonObject,
  item: JsonObject,
  ownership: Ownership,
  state: State,
): boolean {
  if (!internalCall(item, ownership)) return false;

  rememberDropped(event, item, state);

  return true;
}

function filteredCompletedEvent(event: JsonObject, ownership: Ownership, state: State): JsonObject {
  const response = event['response'];
  const filtered = isJsonObject(response)
    ? { ...response, output: filteredOutput(response['output'], ownership) }
    : response;

  return compactIndex(filtered === response ? event : { ...event, response: filtered }, state);
}

function filteredLine(line: string, ownership: Ownership, state: State): string {
  if (!line.startsWith('data:')) return line;
  const event = parsedJson(line.slice('data:'.length).trim());

  if (!isJsonObject(event)) return line;
  const filtered = filterEvent(event, ownership, state);

  return filtered === null ? '' : `data: ${JSON.stringify(filtered)}`;
}

export function filterXAIInternalSearchResponse(response: Response, crossing: Crossing): Response {
  const ownership = crossing.xaiSearchOwnership;

  if (ownership === undefined || response.body === null) return response;
  const state: State = { droppedIds: new Set(), droppedIndexes: new Set() };
  const body = transformingSseLines(response.body, (line) => filteredLine(line, ownership, state));

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
