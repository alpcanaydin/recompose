import type { JsonObject, ProxyDialect } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import {
  codexEventError,
  codexEventErrorBody,
  codexEventErrorStatus,
} from '../provider/codex-event-error';
import { normalizeCodexError } from './codex-errors';

function responseHeaders(response: Response, attribution: Record<string, string>): Headers {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(attribution)) headers.set(name, value);
  headers.set('content-type', 'application/json');

  return headers;
}

function anthropicBody(value: unknown): unknown {
  if (!isJsonObject(value) || !isJsonObject(value['error'])) return value;

  return { type: 'error', error: value['error'] };
}

export async function codexTerminalErrorAnswer(
  event: JsonObject,
  dialect: ProxyDialect,
  attribution: Record<string, string>,
  now = Date.now(),
): Promise<Response | null> {
  const error = codexEventError(event);

  if (error === null) return null;

  const raw = JSON.stringify(codexEventErrorBody(error));
  const normalized = await normalizeCodexError(
    new Response(raw, { status: codexEventErrorStatus(error) }),
    now,
  );
  const text = await normalized.text();
  const value = parsedJson(text);
  const body = dialect === 'anthropic' ? anthropicBody(value) : value;

  return new Response(JSON.stringify(body), {
    status: normalized.status,
    headers: responseHeaders(normalized, attribution),
  });
}
