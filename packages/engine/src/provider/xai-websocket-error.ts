import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

const FREE_USAGE_EXHAUSTED = 'subscription:free-usage-exhausted';

export type XAIWebSocketError = {
  payload: JsonObject;
  status: number;
  retryAfterSeconds?: number;
};

function numericStatus(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function stringStatus(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;

  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function positiveStatus(value: unknown): number | undefined {
  return numericStatus(value) ?? stringStatus(value);
}

function nestedError(payload: JsonObject): JsonObject | null {
  return isJsonObject(payload['error']) ? payload['error'] : null;
}

function inferredStatus(payload: JsonObject, error: JsonObject): number {
  const explicit = [payload['status'], payload['status_code'], error['status'], error['code']]
    .map(positiveStatus)
    .find((status) => status !== undefined);

  if (explicit !== undefined) return explicit;

  const message = typeof error['message'] === 'string' ? error['message'] : '';

  return validationMessage(message) ? 400 : 500;
}

function validationMessage(message: string): boolean {
  return message.includes('Request validation error') || message.includes('"code":"400"');
}

function retryAfter(error: JsonObject): number | undefined {
  return error['code'] === FREE_USAGE_EXHAUSTED ? 24 * 60 * 60 : undefined;
}

export function parseXAIWebSocketError(value: unknown): XAIWebSocketError | null {
  if (!isJsonObject(value)) return null;

  const error = nestedError(value);

  if (error === null) return null;

  const status = inferredStatus(value, error);
  const retryAfterSeconds = retryAfter(error);
  const payload = { ...value, type: 'error', status, error };

  return {
    payload,
    status,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
}

export function messageTooBigPayload(reason: string): JsonObject {
  return {
    type: 'error',
    status: 413,
    error: { code: 'message_too_big', message: reason.trim() || 'message too big' },
  };
}
