import { isJsonObject, parsedJson } from '../gateway-wire';

type ErrorFields = { message: string; type: string; code: string };
type Classification = { type: string; code: string };

const CONTEXT_CODES = new Set(['context_length_exceeded', 'context_too_large']);
const CONTEXT_MESSAGE = /context length|context_length|maximum context|too many tokens/u;
const THINKING_FAILURE = /invalid signature in thinking block|invalid_encrypted_content/u;
const PREVIOUS_RESPONSE_FAILURE = /previous_response_not_found|previous_response_id.*not found/u;
const AUTH_FAILURE = /invalid or expired token|refresh_token_reused/u;
const CAPACITY_FAILURE =
  /selected model is at capacity|model is at capacity\. please try a different model/u;

function stringAt(value: Record<string, unknown>, key: string): string {
  const found = value[key];

  return typeof found === 'string' ? found.trim() : '';
}

function errorFields(value: unknown): ErrorFields {
  const document = isJsonObject(value) ? value : {};
  const nested = isJsonObject(document['error']) ? document['error'] : {};

  return {
    message: stringAt(nested, 'message') || stringAt(document, 'message'),
    type: stringAt(nested, 'type') || stringAt(document, 'type'),
    code: stringAt(nested, 'code'),
  };
}

function numberAt(value: unknown, key: string): number {
  if (!isJsonObject(value)) return 0;

  const found = value[key];

  return typeof found === 'number' && Number.isFinite(found) ? found : 0;
}

function nestedError(value: unknown): Record<string, unknown> {
  return isJsonObject(value) && isJsonObject(value['error']) ? value['error'] : {};
}

function lower(value: string): string {
  return value.trim().toLowerCase();
}

function contextFailure(status: number, fields: ErrorFields): boolean {
  const invalidRequest = fields.type === '' || lower(fields.type) === 'invalid_request_error';

  return (
    status === 413 ||
    CONTEXT_CODES.has(lower(fields.code)) ||
    (invalidRequest && CONTEXT_MESSAGE.test(lower(fields.message)))
  );
}

function contextClassification(status: number, fields: ErrorFields): Classification | null {
  return contextFailure(status, fields)
    ? { type: 'invalid_request_error', code: 'context_too_large' }
    : null;
}

function thinkingClassification(body: string): Classification | null {
  return THINKING_FAILURE.test(lower(body))
    ? { type: 'invalid_request_error', code: 'thinking_signature_invalid' }
    : null;
}

function previousResponseClassification(body: string, fields: ErrorFields): Classification | null {
  return lower(fields.code) === 'previous_response_not_found' ||
    PREVIOUS_RESPONSE_FAILURE.test(lower(body))
    ? { type: 'invalid_request_error', code: 'previous_response_not_found' }
    : null;
}

function authClassification(
  status: number,
  body: string,
  fields: ErrorFields,
): Classification | null {
  return status === 401 ||
    lower(fields.type) === 'authentication_error' ||
    lower(fields.code) === 'invalid_api_key' ||
    AUTH_FAILURE.test(lower(body))
    ? { type: 'authentication_error', code: 'auth_unavailable' }
    : null;
}

function classification(status: number, body: string, fields: ErrorFields): Classification | null {
  return (
    contextClassification(status, fields) ??
    thinkingClassification(body) ??
    previousResponseClassification(body, fields) ??
    authClassification(status, body, fields)
  );
}

function usageLimit(value: unknown): boolean {
  return lower(errorFields(value).type) === 'usage_limit_reached';
}

function modelCapacity(body: string, fields: ErrorFields): boolean {
  return CAPACITY_FAILURE.test(lower(`${fields.message}\n${body}`));
}

function normalizedStatus(status: number, body: string, value: unknown): number {
  return modelCapacity(body, errorFields(value)) || usageLimit(value) ? 429 : status;
}

function absoluteRetrySeconds(value: unknown, now: number): number | null {
  const resetsAt = numberAt(nestedError(value), 'resets_at');
  const untilReset = Math.ceil(resetsAt - now / 1000);

  return resetsAt > 0 && untilReset > 0 ? untilReset : null;
}

function relativeRetrySeconds(value: unknown): number | null {
  const resetsIn = numberAt(nestedError(value), 'resets_in_seconds');

  return resetsIn > 0 ? Math.ceil(resetsIn) : null;
}

function retryAfterSeconds(status: number, value: unknown, now: number): number | null {
  if (status !== 429 || !usageLimit(value)) return null;

  return absoluteRetrySeconds(value, now) ?? relativeRetrySeconds(value);
}

function classifiedBody(status: number, body: string, fields: ErrorFields): Uint8Array | null {
  const known = classification(status, body, fields);

  if (known === null) return null;

  const message = fields.message || body.trim() || `HTTP ${String(status)}`;

  return new TextEncoder().encode(JSON.stringify({ error: { message, ...known } }));
}

export async function normalizeCodexError(response: Response, now = Date.now()): Promise<Response> {
  if (response.ok) return response;

  const bytes = new Uint8Array(await response.arrayBuffer());
  const body = new TextDecoder().decode(bytes);
  const value = parsedJson(body);
  const status = normalizedStatus(response.status, body, value);
  const normalized = classifiedBody(status, body, errorFields(value));
  const headers = new Headers(response.headers);
  const retryAfter = retryAfterSeconds(status, value, now);

  if (retryAfter !== null) headers.set('retry-after', String(retryAfter));

  return new Response(normalized ?? bytes, { status, headers });
}
