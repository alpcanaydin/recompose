type JsonObject = Record<string, unknown>;

export type CodexEventError = {
  message: string;
  type: string;
  code: string;
  raw: JsonObject;
};

const CONTEXT_ERROR = /context length|context_length|context window|too many tokens/u;
const THINKING_ERROR = /invalid signature in thinking block|invalid_encrypted_content/u;
const INVALID_TYPES = new Set(['invalid_request_error', 'invalid_request']);
const INVALID_CODES = new Set(['cyber_policy', 'context_too_large', 'thinking_signature_invalid']);

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringAt(value: JsonObject, key: string): string {
  const found = value[key];

  return typeof found === 'string' ? found.trim() : '';
}

function directErrorRecord(event: JsonObject): JsonObject | null {
  if (event['type'] !== 'error') return null;

  return isJsonObject(event['error']) ? event['error'] : event;
}

function failedErrorRecord(event: JsonObject): JsonObject | null {
  if (event['type'] !== 'response.failed' || !isJsonObject(event['response'])) return null;

  const error = event['response']['error'];

  return isJsonObject(error) ? error : null;
}

function errorRecord(value: unknown): JsonObject | null {
  if (!isJsonObject(value)) return null;

  return directErrorRecord(value) ?? failedErrorRecord(value);
}

export function codexEventError(event: unknown): CodexEventError | null {
  const raw = errorRecord(event);

  if (raw === null) return null;

  return {
    message: stringAt(raw, 'message') || 'Codex response failed',
    type: stringAt(raw, 'type'),
    code: stringAt(raw, 'code'),
    raw: structuredClone(raw),
  };
}

function lower(value: string): string {
  return value.toLowerCase();
}

function firstNonBlank(values: readonly string[]): string {
  return values.find((value) => value !== '') ?? 'api_error';
}

function contextError(error: CodexEventError): boolean {
  const code = lower(error.code);
  const text = lower(`${error.code}\n${error.message}`);

  return (
    code === 'context_length_exceeded' || code === 'context_too_large' || CONTEXT_ERROR.test(text)
  );
}

function thinkingError(error: CodexEventError): boolean {
  return THINKING_ERROR.test(lower(`${error.code}\n${error.message}`));
}

export function codexEventErrorCode(error: CodexEventError): string {
  if (contextError(error)) return 'context_too_large';
  if (thinkingError(error)) return 'thinking_signature_invalid';

  return firstNonBlank([error.code, error.type]);
}

function authenticationError(error: CodexEventError): boolean {
  return lower(error.type) === 'authentication_error' || lower(error.code) === 'invalid_api_key';
}

function rateLimitError(error: CodexEventError): boolean {
  const type = lower(error.type);

  return type === 'rate_limit_error' || type === 'usage_limit_reached';
}

function invalidRequestError(error: CodexEventError): boolean {
  return (
    INVALID_TYPES.has(lower(error.type)) || INVALID_CODES.has(lower(codexEventErrorCode(error)))
  );
}

export function codexEventErrorStatus(error: CodexEventError): number {
  if (authenticationError(error)) return 401;
  if (rateLimitError(error)) return 429;
  if (invalidRequestError(error)) return 400;

  return 502;
}

function defaultErrorType(status: number): string {
  if (status === 400) return 'invalid_request_error';
  if (status === 401) return 'authentication_error';
  if (status === 429) return 'rate_limit_error';

  return 'upstream_error';
}

export function codexEventErrorBody(error: CodexEventError): JsonObject {
  const status = codexEventErrorStatus(error);

  return {
    error: {
      ...error.raw,
      message: error.message,
      type: error.type || defaultErrorType(status),
      code: codexEventErrorCode(error),
    },
  };
}
