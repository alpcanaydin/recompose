import { WebSocket } from 'ws';

import type { JsonObject } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import {
  codexResponsesWebSocketUrl,
  canonicalCodexWebSocketHeaders,
  codexSocketText,
  defaultCodexConnector,
  sanitizeCodexWebSocketBody,
  type CodexSocket,
  type CodexSocketConnector,
} from './codex-websocket-connector';

export {
  CodexWebSocketError,
  codexResponsesWebSocketUrl,
  type CodexSocket,
} from './codex-websocket-connector';

export type CodexWebSocketLifecycle = {
  bind(close: () => void): void;
  end(reason: string): void;
};

export type CodexWebSocketTurn = {
  sessionId: string;
  authId: string;
  baseUrl: string;
  headers: Record<string, string>;
  body: JsonObject;
  lifecycle?: CodexWebSocketLifecycle;
  downstream(payload: string): void;
};

export class CodexWebSocketExecutor {
  private readonly connector: CodexSocketConnector;
  private readonly sessions = new Map<string, CodexWebSocketSession>();

  public constructor(connector: CodexSocketConnector = defaultCodexConnector) {
    this.connector = connector;
  }

  public async execute(turn: CodexWebSocketTurn): Promise<void> {
    const session = this.session(turn.sessionId);

    await session.execute(turn, this.connector);
  }

  public closeSession(sessionId: string): void {
    this.sessions.get(sessionId)?.close('session closed');
    this.sessions.delete(sessionId);
  }

  public closeAll(): void {
    for (const session of this.sessions.values()) session.close('executor closed');
    this.sessions.clear();
  }

  private session(id: string): CodexWebSocketSession {
    const existing = this.sessions.get(id);

    if (existing !== undefined) return existing;

    const created = new CodexWebSocketSession();

    this.sessions.set(id, created);

    return created;
  }
}

type ActiveTurn = {
  downstream(payload: string): void;
  resolve(): void;
  reject(error: Error): void;
};

class CodexWebSocketSession {
  private socket: CodexSocket | undefined;
  private authId: string | undefined;
  private url: string | undefined;
  private lifecycle: CodexWebSocketLifecycle | undefined;
  private lifecycleSocket: CodexSocket | undefined;
  private active: ActiveTurn | undefined;
  private queue: Promise<void> = Promise.resolve();
  private ended = false;

  public async execute(turn: CodexWebSocketTurn, connector: CodexSocketConnector): Promise<void> {
    const work = async (): Promise<void> => {
      await this.run(turn, connector);
    };

    this.queue = this.queue.then(work, work);

    await this.queue;
  }

  public close(reason: string): void {
    this.invalidate(reason);
  }

  private async run(turn: CodexWebSocketTurn, connector: CodexSocketConnector): Promise<void> {
    const url = codexResponsesWebSocketUrl(turn.baseUrl);
    const socket = await this.connection(
      turn.authId,
      url,
      canonicalCodexWebSocketHeaders(turn.headers),
      connector,
    );

    this.bindLifecycle(turn.lifecycle, socket);

    await new Promise<void>((resolve, reject) => {
      this.active = {
        downstream: (payload) => {
          turn.downstream(payload);
        },
        resolve,
        reject,
      };
      socket.send(JSON.stringify(sanitizeCodexWebSocketBody(turn.body)));
    });
  }

  private async connection(
    authId: string,
    url: string,
    headers: Record<string, string>,
    connector: CodexSocketConnector,
  ): Promise<CodexSocket> {
    const existing = this.reusable(authId, url);

    if (existing !== undefined) return existing;

    this.invalidate('target changed');

    const socket = await connector(url, headers);

    this.socket = socket;
    this.authId = authId;
    this.url = url;
    this.ended = false;
    this.listen(socket);

    return socket;
  }

  private reusable(authId: string, url: string): CodexSocket | undefined {
    const socket = this.socket;

    return socket?.readyState === WebSocket.OPEN && this.authId === authId && this.url === url
      ? socket
      : undefined;
  }

  private bindLifecycle(lifecycle: CodexWebSocketLifecycle | undefined, socket: CodexSocket): void {
    if (lifecycle === undefined) return;
    if (this.lifecycle === lifecycle && this.lifecycleSocket === socket) return;

    try {
      lifecycle.bind(() => {
        this.invalidate('lifecycle ended');
      });
    } catch (error) {
      this.invalidate('lifecycle bind failed');

      throw error;
    }

    this.lifecycle = lifecycle;
    this.lifecycleSocket = socket;
  }

  private listen(socket: CodexSocket): void {
    socket.onMessage((data) => {
      this.message(socket, codexSocketText(data));
    });
    socket.onClose((_code, reason) => {
      this.terminal(socket, new Error(reason.toString() || 'upstream closed'));
    });
    socket.onError((error) => {
      this.terminal(socket, error);
    });
  }

  private message(socket: CodexSocket, payload: string): void {
    if (this.socket !== socket || this.active === undefined) return;

    this.active.downstream(payload);

    const value = parsedJson(payload);

    if (isErrorPayload(value)) {
      this.rejectActive(payload);

      return;
    }

    if (isCompletedPayload(value)) this.resolveActive();
  }

  private rejectActive(payload: string): void {
    const active = this.active;

    if (active === undefined) return;

    this.invalidate('upstream error');
    active.reject(new Error(payload));
  }

  private resolveActive(): void {
    const active = this.active;

    if (active === undefined) return;

    this.active = undefined;
    active.resolve();
  }

  private terminal(socket: CodexSocket, error: Error): void {
    if (this.socket !== socket) return;

    const active = this.active;

    this.invalidate('terminal failure');
    active?.reject(error);
  }

  private invalidate(reason: string): void {
    const socket = this.socket;

    this.socket = undefined;
    this.authId = undefined;
    this.url = undefined;
    this.lifecycleSocket = undefined;
    socket?.close(1000, reason);
    this.endLifecycle(reason);
  }

  private endLifecycle(reason: string): void {
    if (this.lifecycle === undefined || this.ended) return;

    this.ended = true;
    this.lifecycle.end(reason);
    this.lifecycle = undefined;
  }
}

function isErrorPayload(value: unknown): boolean {
  return isJsonObject(value) && value['type'] === 'error';
}

function isCompletedPayload(value: unknown): boolean {
  return isJsonObject(value) && value['type'] === 'response.completed';
}
