import type { JsonObject } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { transformingSseLines } from '../stream-wire';

type NamespaceRef = { namespace: string; name: string };

function restoredCall(value: JsonObject, refs: Record<string, NamespaceRef>): JsonObject {
  if (value['type'] !== 'function_call' || typeof value['name'] !== 'string') return value;

  const ref = refs[value['name']];

  return ref === undefined ? value : { ...value, name: ref.name, namespace: ref.namespace };
}

function restoredValue(value: unknown, refs: Record<string, NamespaceRef>): unknown {
  if (Array.isArray(value)) return value.map((item) => restoredValue(item, refs));
  if (!isJsonObject(value)) return value;

  const restored = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, restoredValue(item, refs)]),
  );

  return restoredCall(restored, refs);
}

function restoredLine(line: string, refs: Record<string, NamespaceRef>): string {
  const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line;

  if (!trimmed.startsWith('data:')) return trimmed;

  const payload = trimmed.slice('data:'.length).trim();
  const parsed = parsedJson(payload);

  return isJsonObject(parsed) ? `data: ${JSON.stringify(restoredValue(parsed, refs))}` : trimmed;
}

function transformedBody(
  body: ReadableStream<Uint8Array>,
  refs: Record<string, NamespaceRef>,
): ReadableStream<Uint8Array> {
  return transformingSseLines(body, (line) => restoredLine(line, refs));
}

export function restoreXAIToolResponse(
  response: Response,
  refs: Record<string, NamespaceRef>,
): Response {
  if (response.body === null || Object.keys(refs).length === 0) return response;

  return new Response(transformedBody(response.body, refs), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
