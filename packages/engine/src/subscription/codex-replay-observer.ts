import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { codexEventError, codexEventErrorCode } from '../provider/codex-event-error';
import { orderedCodexItems } from './codex-output-items';
import { observingSseLines } from './observing-sse';

type Collected = { indexed: Map<number, JsonObject>; fallback: JsonObject[] };

function collectedIndex(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function collectDone(value: JsonObject, collected: Collected): void {
  if (value['type'] !== 'response.output_item.done' || !isJsonObject(value['item'])) return;

  const index = collectedIndex(value['output_index']);

  if (index !== undefined) {
    collected.indexed.set(index, structuredClone(value['item']));
  } else {
    collected.fallback.push(structuredClone(value['item']));
  }
}

function completedOutput(value: JsonObject, collected: Collected): unknown[] | undefined {
  if (value['type'] !== 'response.completed' || !isJsonObject(value['response'])) return undefined;

  const output = value['response']['output'];

  return Array.isArray(output) && output.length > 0
    ? Array.from(output, (item: unknown) => item)
    : [...orderedCodexItems(collected.indexed), ...collected.fallback];
}

function invalidSignatureFailure(value: JsonObject): boolean {
  const error = codexEventError(value);

  return error !== null && codexEventErrorCode(error) === 'thinking_signature_invalid';
}

function observeEvent(
  value: unknown,
  collected: Collected,
  commit: (output: unknown) => void,
  clear: () => void,
): void {
  if (!isJsonObject(value)) return;

  collectDone(value, collected);
  const output = completedOutput(value, collected);

  if (output !== undefined) commit(output);
  else if (invalidSignatureFailure(value)) clear();
}

function observeLine(
  line: string,
  collected: Collected,
  commit: (output: unknown) => void,
  clear: () => void,
): void {
  if (!line.startsWith('data:')) return;

  try {
    observeEvent(JSON.parse(line.slice(5).trim()), collected, commit, clear);
  } catch {
    return;
  }
}

function observingStream(
  body: ReadableStream<Uint8Array>,
  commit: (output: unknown) => void,
  clear: () => void,
): ReadableStream<Uint8Array> {
  const collected: Collected = { indexed: new Map(), fallback: [] };

  return observingSseLines(body, (line) => {
    observeLine(line, collected, commit, clear);
  });
}

async function observeJson(
  response: Response,
  commit: (output: unknown) => void,
  clear: () => void,
): Promise<Response> {
  const value: unknown = await response
    .clone()
    .json()
    .catch(() => null);

  if (isJsonObject(value) && value['status'] === 'completed') commit(value['output']);
  else if (isJsonObject(value) && invalidSignatureFailure(value)) clear();

  return response;
}

export async function observeCodexReasoning(
  response: Response,
  commit: (output: unknown) => void,
  clear: () => void,
): Promise<Response> {
  if (!response.ok || response.body === null) return response;

  if (response.headers.get('content-type')?.includes('text/event-stream') === true) {
    return new Response(observingStream(response.body, commit, clear), response);
  }

  return observeJson(response, commit, clear);
}
