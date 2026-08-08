import type { IncomingMessage } from 'node:http';

import { createHash } from 'node:crypto';
import { WebSocket, type RawData } from 'ws';

import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { websocketRawText } from './websocket-raw-text';

export type CodexSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onMessage(listener: (data: RawData) => void): void;
  onClose(listener: (code: number, reason: Buffer) => void): void;
  onError(listener: (error: Error) => void): void;
};

export type CodexSocketConnector = (
  url: string,
  headers: Record<string, string>,
) => Promise<CodexSocket>;

export class CodexWebSocketError extends Error {
  public readonly status: number;

  public constructor(status: number, message: string) {
    super(message);
    this.name = 'CodexWebSocketError';
    this.status = status;
  }
}

export function codexResponsesWebSocketUrl(baseUrl: string): string {
  const url = new URL(baseUrl);

  if (url.protocol === 'http:') url.protocol = 'ws:';
  else if (url.protocol === 'https:') url.protocol = 'wss:';
  else throw new Error(`unsupported Codex WebSocket URL scheme ${url.protocol}`);

  url.pathname = `${url.pathname.replace(/\/+$/u, '')}/responses`;
  url.search = '';
  url.hash = '';

  return url.href;
}

export function sanitizeCodexWebSocketBody(body: JsonObject): JsonObject {
  const input = body['input'];

  if (!Array.isArray(input)) return body;

  return { ...body, input: input.flatMap(sanitizedInputItem) };
}

function sanitizedInputItem(value: unknown): unknown[] {
  if (!isJsonObject(value)) return [value];

  const id = typeof value['id'] === 'string' ? value['id'] : undefined;

  if (id === undefined) return [value];

  return sanitizedIdentifiedItem(value, id);
}

function sanitizedIdentifiedItem(value: JsonObject, id: string): unknown[] {
  if (dropsReasoningItem(value, id)) return [];

  const normalized = normalizedItemId(value, id);

  return [{ ...value, id: normalized }];
}

function dropsReasoningItem(value: JsonObject, id: string): boolean {
  return value['type'] === 'reasoning' && id.length > 64;
}

function normalizedItemId(value: JsonObject, id: string): string {
  if (value['type'] === 'message' && id.startsWith('item_')) return `msg_${id}`;
  if (id.length <= 64) return id;

  return shortenedId(id);
}

function shortenedId(value: string): string {
  return `item_${createHash('sha256').update(value).digest('hex').slice(0, 48)}`;
}

export function canonicalCodexWebSocketHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const legacy = headers['Session_id'] ?? headers['Session-Id'];
  const { Session_id: _legacy, 'Session-Id': _canonical, ...rest } = headers;

  return legacy === undefined ? rest : { ...rest, session_id: legacy };
}

export function codexWebSocketProxyURL(
  authProxy: string | undefined,
  globalProxy: string | undefined,
): string | null {
  if (authProxy === 'direct') return null;

  return authProxy ?? globalProxy ?? null;
}

export class CodexIdentityConfusion {
  private readonly key: string;
  private readonly reverse = new Map<string, string>();

  public constructor(key: string) {
    this.key = key;
  }

  public remap(value: string, kind: string): string {
    const mapped = uuidLike(`${this.key}\0${kind}\0${value}`);

    this.reverse.set(mapped, value);

    return mapped;
  }

  public restore(value: string): string {
    return this.reverse.get(value) ?? value;
  }

  public request(
    body: JsonObject,
    headers: Record<string, string>,
  ): {
    body: JsonObject;
    headers: Record<string, string>;
  } {
    const prompt =
      typeof body['prompt_cache_key'] === 'string' ? body['prompt_cache_key'] : undefined;

    if (prompt === undefined) return { body, headers };

    const mapped = this.remap(prompt, 'prompt-cache');

    return {
      body: { ...body, prompt_cache_key: mapped },
      headers: { ...headers, session_id: mapped, 'X-Client-Request-Id': mapped },
    };
  }

  public response(value: unknown): unknown {
    if (!isJsonObject(value) || !isJsonObject(value['response'])) return value;

    const response = value['response'];
    const id = typeof response['id'] === 'string' ? response['id'] : undefined;

    return id === undefined ? value : { ...value, response: { ...response, id: this.restore(id) } };
  }
}

function uuidLike(value: string): string {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export function websocketConnectionKey(
  provider: 'codex' | 'xai',
  credential: string,
  model: string,
): string {
  return `${provider}\0${credential}\0${model.trim().toLowerCase()}`;
}

export async function defaultCodexConnector(
  url: string,
  headers: Record<string, string>,
): Promise<CodexSocket> {
  return new Promise<CodexSocket>((resolve, reject) => {
    const socket = new WebSocket(url, { headers });

    socket.once('open', () => {
      resolve(socketAdapter(socket));
    });
    socket.once('unexpected-response', (_request, response) => {
      reject(handshakeError(response));
      socket.close();
    });
    socket.once('error', reject);
  });
}

export function codexSocketText(data: RawData): string {
  return websocketRawText(data);
}

function socketAdapter(socket: WebSocket): CodexSocket {
  return {
    get readyState() {
      return socket.readyState;
    },
    send(data) {
      socket.send(data);
    },
    close(code, reason) {
      socket.close(code, reason);
    },
    onMessage(listener) {
      socket.on('message', listener);
    },
    onClose(listener) {
      socket.once('close', listener);
    },
    onError(listener) {
      socket.once('error', listener);
    },
  };
}

function handshakeError(response: IncomingMessage): CodexWebSocketError {
  const status = response.statusCode ?? 500;

  return new CodexWebSocketError(status, `Codex WebSocket handshake failed with ${String(status)}`);
}
