import type { WebSocketData, WebSocketLike, WebSocketServerLike } from '@hono/node-server';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { RawData } from 'ws';

import { WebSocket, WebSocketServer } from 'ws';

function readyState(socket: WebSocket): 0 | 1 | 2 | 3 {
  if (socket.readyState === WebSocket.CONNECTING) return 0;
  if (socket.readyState === WebSocket.OPEN) return 1;
  if (socket.readyState === WebSocket.CLOSING) return 2;

  return 3;
}

function webSocketData(data: RawData): WebSocketData {
  if (Array.isArray(data)) return data;

  return data;
}

function sendData(data: string | ArrayBuffer | ArrayBufferView): string | ArrayBuffer | Uint8Array {
  if (typeof data === 'string' || data instanceof ArrayBuffer) return data;

  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

class NodeWebSocket implements WebSocketLike {
  private readonly socket: WebSocket;

  public constructor(socket: WebSocket) {
    this.socket = socket;
  }

  public get protocol(): string {
    return this.socket.protocol;
  }

  public get readyState(): 0 | 1 | 2 | 3 {
    return readyState(this.socket);
  }

  public close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }

  public send(
    data: string | ArrayBuffer | ArrayBufferView,
    options?: { compress?: boolean },
  ): void {
    this.socket.send(sendData(data), { compress: options?.compress });
  }

  public on(event: 'message', listener: (data: WebSocketData, isBinary: boolean) => void): this;
  public on(event: 'close', listener: (code: number, reason: Uint8Array) => void): this;
  public on(event: 'error', listener: (error: unknown) => void): this;
  public on(
    event: 'message' | 'close' | 'error',
    listener:
      | ((data: WebSocketData, isBinary: boolean) => void)
      | ((code: number, reason: Uint8Array) => void)
      | ((error: unknown) => void),
  ): this {
    if (event === 'message') {
      this.socket.on('message', (data, isBinary) => {
        Reflect.apply(listener, undefined, [webSocketData(data), isBinary]);
      });
    } else if (event === 'close') {
      this.socket.on('close', (code, reason) => {
        Reflect.apply(listener, undefined, [code, reason]);
      });
    } else {
      this.socket.on('error', (error) => {
        Reflect.apply(listener, undefined, [error]);
      });
    }

    return this;
  }

  public off(_event: 'message', _listener: (data: WebSocketData, isBinary: boolean) => void): this {
    this.socket.removeAllListeners('message');

    return this;
  }
}

export class NodeWebSocketServer implements WebSocketServerLike {
  public readonly options = { noServer: true };
  private readonly server = new WebSocketServer({ noServer: true });
  private readonly connectionListeners: unknown[] = [];
  private readonly headerListeners = new Map<unknown, (headers: string[]) => void>();

  public on(
    event: 'connection',
    listener: (socket: WebSocketLike, request: IncomingMessage) => void,
  ): this;
  public on(event: 'headers', listener: (headers: string[]) => void): this;
  public on(
    event: 'connection' | 'headers',
    listener:
      | ((socket: WebSocketLike, request: IncomingMessage) => void)
      | ((headers: string[]) => void),
  ): this {
    if (event === 'connection') {
      this.connectionListeners.push(listener);

      return this;
    }

    const wrapped = (headers: string[]): void => {
      Reflect.apply(listener, undefined, [headers]);
    };

    this.headerListeners.set(listener, wrapped);
    this.server.on('headers', wrapped);

    return this;
  }

  public off(_event: 'headers', listener: (headers: string[]) => void): this {
    const wrapped = this.headerListeners.get(listener);

    if (wrapped !== undefined) {
      this.server.off('headers', wrapped);
      this.headerListeners.delete(listener);
    }

    return this;
  }

  public emit(_event: 'connection', socket: WebSocketLike, request: IncomingMessage): boolean {
    for (const listener of this.connectionListeners) {
      if (typeof listener === 'function') Reflect.apply(listener, undefined, [socket, request]);
    }

    return this.connectionListeners.length > 0;
  }

  public handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    callback: (socket: WebSocketLike) => void,
  ): void {
    this.server.handleUpgrade(request, socket, head, (upgraded) => {
      callback(new NodeWebSocket(upgraded));
    });
  }

  public terminateAll(): void {
    for (const client of this.server.clients) client.terminate();
  }

  public close(): void {
    this.server.close();
  }
}
