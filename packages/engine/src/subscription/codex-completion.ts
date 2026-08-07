import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { jsonEventsFrom, namedSseBodyFrom } from '../stream-wire';
import { orderedCodexItems } from './codex-output-items';

const TERMINAL_EVENT_TYPES = new Set([
  'response.completed',
  'response.incomplete',
  'response.failed',
]);

function outputIndex(event: JsonObject): number | null {
  const index = event['output_index'];

  return typeof index === 'number' && Number.isInteger(index) && index >= 0 ? index : null;
}

function collectDoneItem(event: JsonObject, indexed: Map<number, JsonObject>): void {
  if (event['type'] !== 'response.output_item.done' || !isJsonObject(event['item'])) return;

  const index = outputIndex(event);

  if (index !== null) indexed.set(index, structuredClone(event['item']));
}

function hasItemId(item: JsonObject): boolean {
  const id = item['id'];

  return typeof id === 'string' && id !== '';
}

function fallbackItemId(fallback: JsonObject | undefined): string | undefined {
  const id = fallback?.['id'];

  return typeof id === 'string' ? id : undefined;
}

function hydratedItem(item: unknown, fallback: JsonObject | undefined): unknown {
  if (!isJsonObject(item) || hasItemId(item)) return item;

  const id = fallbackItemId(fallback);

  return id === undefined ? item : { ...item, id };
}

export function hydrateCodexResponse(
  response: JsonObject,
  indexed: ReadonlyMap<number, JsonObject>,
): JsonObject {
  const output = Array.isArray(response['output']) ? response['output'] : [];
  const hydrated =
    output.length === 0
      ? orderedCodexItems(indexed)
      : output.map((item, index) => hydratedItem(item, indexed.get(index)));

  return { ...response, output: hydrated };
}

function hydratedTerminalEvent(
  event: JsonObject & { type: string },
  indexed: ReadonlyMap<number, JsonObject>,
): JsonObject & { type: string } {
  if (!TERMINAL_EVENT_TYPES.has(event.type) || !isJsonObject(event['response'])) {
    return event;
  }

  return { ...event, response: hydrateCodexResponse(event['response'], indexed) };
}

async function* hydratedEvents(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<JsonObject & { type: string }> {
  const indexed = new Map<number, JsonObject>();

  for await (const event of jsonEventsFrom(body)) {
    collectDoneItem(event, indexed);
    yield hydratedTerminalEvent(event, indexed);
  }
}

export function hydrateCodexCompletionStream(response: Response): Response {
  if (
    response.body === null ||
    response.headers.get('content-type')?.includes('text/event-stream') !== true
  ) {
    return response;
  }

  const headers = new Headers(response.headers);

  headers.delete('content-length');

  return new Response(namedSseBodyFrom(hydratedEvents(response.body)), {
    status: response.status,
    headers,
  });
}
