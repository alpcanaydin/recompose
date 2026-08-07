import type { RawData } from 'ws';

import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { parseXAIWebSocketError } from './xai-websocket-error';

export function upstreamXAIWebSocketUrl(origin: string): string {
  const url = new URL(`${origin.replace(/\/+$/u, '')}/responses`);

  if (url.protocol === 'http:') url.protocol = 'ws:';
  else if (url.protocol === 'https:') url.protocol = 'wss:';
  else throw new Error(`unsupported xAI WebSocket URL scheme ${url.protocol}`);

  return url.href;
}

export function xaiWebSocketRequestBody(value: JsonObject): JsonObject {
  const nested = value['response'];
  const source = isJsonObject(nested) ? nested : value;
  const {
    type: _type,
    stream: _stream,
    stream_options: _streamOptions,
    background: _background,
    ...body
  } = source;
  const previous = body['previous_response_id'];

  if (typeof previous === 'string' && previous.trim() !== '') delete body['instructions'];

  return { ...body, type: 'response.create', store: true };
}

export function xaiWebSocketText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString();
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data)).toString();

  return Buffer.from(data).toString();
}

export function xaiWebSocketErrorPayload(value: unknown, fallbackStatus: number): JsonObject {
  const parsed = parseXAIWebSocketError(value);

  if (parsed === null) {
    return {
      type: 'error',
      status: fallbackStatus,
      error: { message: 'upstream WebSocket error' },
    };
  }

  return {
    ...parsed.payload,
    ...(parsed.retryAfterSeconds === undefined
      ? {}
      : { retry_after_seconds: parsed.retryAfterSeconds }),
  };
}
