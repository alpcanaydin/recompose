import type { JsonObject } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';

export type RelaySocket = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

export type RelayRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
};

type RelayTTFT = { channelId: string; requestId: string; milliseconds: number };

type RelayOptions = {
  onConnected?: ((channelId: string) => void) | undefined;
  onDisconnected?: ((channelId: string, reason: Error) => void) | undefined;
  onTTFT?: ((measurement: RelayTTFT) => void) | undefined;
  now?: (() => number) | undefined;
  id?: (() => string) | undefined;
};

type RelayMessage = { id: string; type: string; payload: JsonObject };
type Pending = {
  startedAt: number;
  resolve: (response: Response) => void;
  reject: (reason: Error) => void;
  controller?: ReadableStreamDefaultController<Uint8Array> | undefined;
  settled: boolean;
  measured: boolean;
};

type Session = { socket: RelaySocket; pending: Map<string, Pending> };

const encoder = new TextEncoder();

function relayMessage(text: string): RelayMessage | null {
  const value = parsedJson(text);

  if (!isJsonObject(value)) return null;

  const id = value['id'];
  const type = value['type'];
  const payload = value['payload'];

  return typeof id === 'string' && typeof type === 'string'
    ? { id, type, payload: isJsonObject(payload) ? payload : {} }
    : null;
}

function headerRecord(value: unknown): Headers {
  const headers = new Headers();

  if (!isJsonObject(value)) return headers;

  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string') headers.set(key, raw);
    else if (Array.isArray(raw)) {
      raw.forEach((item) => {
        if (typeof item === 'string') headers.append(key, item);
      });
    }
  }

  return headers;
}

function responseStatus(payload: JsonObject): number {
  const status = payload['status'];

  return typeof status === 'number' && Number.isInteger(status) ? status : 200;
}

function relayError(payload: JsonObject): Error {
  const message = payload['error'];
  const status = payload['status'];
  const suffix = typeof status === 'number' ? ` (status=${String(status)})` : '';

  return new Error(`${typeof message === 'string' ? message : 'wsrelay: upstream error'}${suffix}`);
}

export class AIStudioRelay {
  private readonly sessions = new Map<string, Session>();
  private readonly options: RelayOptions;

  public constructor(options: RelayOptions = {}) {
    this.options = options;
  }

  public attach(socket: RelaySocket, channelId = this.randomChannelId()): string {
    const key = channelId.trim().toLowerCase();
    const previous = this.sessions.get(key);

    if (previous !== undefined)
      this.endSession(key, previous, new Error('replaced by new connection'));

    this.sessions.set(key, { socket, pending: new Map() });
    this.options.onConnected?.(key);

    return key;
  }

  public receive(channelId: string, text: string): void {
    const session = this.sessions.get(channelId.toLowerCase());
    const message = relayMessage(text);

    if (session === undefined || message === null) return;

    if (message.type === 'ping') {
      session.socket.send(JSON.stringify({ id: message.id, type: 'pong' }));

      return;
    }

    const pending = session.pending.get(message.id);

    if (pending !== undefined) this.handleMessage(channelId, session, pending, message);
  }

  public detach(channelId: string, reason = new Error('wsrelay: connection closed')): void {
    const key = channelId.toLowerCase();
    const session = this.sessions.get(key);

    if (session !== undefined) this.endSession(key, session, reason);
  }

  public async request(
    channelId: string,
    request: RelayRequest,
    signal?: AbortSignal,
  ): Promise<Response> {
    const key = channelId.trim().toLowerCase();
    const session = this.sessions.get(key);

    if (session === undefined)
      return Promise.reject(new Error(`wsrelay: provider ${key} not connected`));

    return new Promise<Response>((resolve, reject) => {
      const requestId = this.requestId();
      const pending: Pending = {
        startedAt: this.now(),
        resolve,
        reject,
        settled: false,
        measured: false,
      };

      session.pending.set(requestId, pending);
      this.watchAbort(key, requestId, pending, signal);
      session.socket.send(JSON.stringify(this.envelope(requestId, request)));
    });
  }

  private handleMessage(
    channelId: string,
    session: Session,
    pending: Pending,
    message: RelayMessage,
  ): void {
    this.measure(channelId, message.id, pending);

    if (message.type === 'http_response') {
      this.finishResponse(session, message, pending);

      return;
    }

    this.handleStreamMessage(session, pending, message);
  }

  private handleStreamMessage(session: Session, pending: Pending, message: RelayMessage): void {
    if (message.type === 'stream_start') this.startStream(message.payload, pending);
    else if (message.type === 'stream_chunk') this.streamChunk(message.payload, pending);
    else if (message.type === 'stream_end') this.finishStream(session, message.id, pending);
    else if (message.type === 'error') {
      this.failPending(session, message.id, pending, relayError(message.payload));
    }
  }

  private startStream(payload: JsonObject, pending: Pending): void {
    if (pending.settled) return;

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        pending.controller = controller;
      },
    });

    pending.settled = true;
    pending.resolve(
      new Response(stream, {
        status: responseStatus(payload),
        headers: headerRecord(payload['headers']),
      }),
    );
  }

  private streamChunk(payload: JsonObject, pending: Pending): void {
    if (!pending.settled) this.startStream({}, pending);

    const data = payload['data'];

    if (typeof data === 'string') pending.controller?.enqueue(encoder.encode(data));
  }

  private finishStream(session: Session, id: string, pending: Pending): void {
    if (!pending.settled) this.startStream({}, pending);

    pending.controller?.close();
    session.pending.delete(id);
  }

  private finishResponse(session: Session, message: RelayMessage, pending: Pending): void {
    if (pending.settled) return;

    pending.settled = true;
    session.pending.delete(message.id);
    const body = message.payload['body'];

    pending.resolve(
      new Response(typeof body === 'string' ? body : '', {
        status: responseStatus(message.payload),
        headers: headerRecord(message.payload['headers']),
      }),
    );
  }

  private failPending(session: Session, id: string, pending: Pending, reason: Error): void {
    session.pending.delete(id);
    if (pending.controller !== undefined) pending.controller.error(reason);
    else pending.reject(reason);
  }

  private endSession(channelId: string, session: Session, reason: Error): void {
    if (this.sessions.get(channelId) === session) this.sessions.delete(channelId);
    for (const [id, pending] of session.pending) this.failPending(session, id, pending, reason);
    session.socket.close(1012, reason.message);
    this.options.onDisconnected?.(channelId, reason);
  }

  private measure(channelId: string, requestId: string, pending: Pending): void {
    if (pending.measured) return;

    pending.measured = true;
    this.options.onTTFT?.({
      channelId,
      requestId,
      milliseconds: Math.max(0, this.now() - pending.startedAt),
    });
  }

  private watchAbort(
    channelId: string,
    requestId: string,
    pending: Pending,
    signal?: AbortSignal,
  ): void {
    signal?.addEventListener(
      'abort',
      () => {
        const session = this.sessions.get(channelId);

        if (session !== undefined)
          this.failPending(session, requestId, pending, new Error('wsrelay: request aborted'));
      },
      { once: true },
    );
  }

  private envelope(requestId: string, request: RelayRequest): JsonObject {
    return {
      id: requestId,
      type: 'http_request',
      payload: { ...request, sent_at: new Date().toISOString() },
    };
  }

  private randomChannelId(): string {
    return `aistudio-${this.requestId().replaceAll('-', '').slice(0, 16)}`;
  }

  private requestId(): string {
    return this.options.id?.() ?? crypto.randomUUID();
  }

  private now(): number {
    return this.options.now?.() ?? performance.now();
  }
}

const sharedRelay = new AIStudioRelay();

export function aiStudioRelayRuntime(): AIStudioRelay {
  return sharedRelay;
}
