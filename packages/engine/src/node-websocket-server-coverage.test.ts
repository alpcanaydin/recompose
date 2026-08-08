import type { WebSocketData, WebSocketLike } from '@hono/node-server';
import type { RawData } from 'ws';

import { createServer, type Server } from 'node:http';
import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { NodeWebSocketServer } from './node-websocket-server';

type Harness = {
  port: number;
  server: NodeWebSocketServer;
  accepted: Promise<WebSocketLike>;
  close: () => Promise<void>;
};

async function boundPort(http: Server): Promise<number> {
  return new Promise<number>((resolve) => {
    http.listen(0, '127.0.0.1', () => {
      const address = http.address();

      resolve(typeof address === 'object' && address !== null ? address.port : 0);
    });
  });
}

async function harness(): Promise<Harness> {
  const http = createServer();
  const server = new NodeWebSocketServer();
  let accept = (_socket: WebSocketLike): void => undefined;
  const accepted = new Promise<WebSocketLike>((resolve) => {
    accept = resolve;
  });

  http.on('upgrade', (request, socket, head) => {
    server.handleUpgrade(request, socket, head, (upgraded) => {
      server.emit('connection', upgraded, request);
      accept(upgraded);
    });
  });
  server.on('connection', () => undefined);

  const port = await boundPort(http);

  return {
    port,
    server,
    accepted,
    close: async () =>
      new Promise<void>((resolve) => {
        server.terminateAll();
        server.close();
        http.close(() => {
          resolve();
        });
      }),
  };
}

async function opened(port: number): Promise<WebSocket> {
  const client = new WebSocket(`ws://127.0.0.1:${String(port)}/`);

  return new Promise<WebSocket>((resolve) => {
    client.once('open', () => {
      resolve(client);
    });
  });
}

function frameText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');

  return Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data).toString('utf8');
}

function socketText(data: WebSocketData): string {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (data instanceof Uint8Array) return new TextDecoder().decode(data);

  return data.map((part) => new TextDecoder().decode(part)).join('');
}

async function nextMessage(client: WebSocket): Promise<string> {
  return new Promise<string>((resolve) => {
    client.once('message', (data) => {
      resolve(frameText(data));
    });
  });
}

async function settled(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 50);
  });
}

describe('Serving a WebSocket over the Node adaptor', () => {
  it('should report an accepted socket as open and then as closed', async () => {
    const fixture = await harness();
    const client = await opened(fixture.port);
    const socket = await fixture.accepted;
    const whileOpen = socket.readyState;
    const ended = new Promise<void>((resolve) => {
      socket.on('close', () => {
        resolve();
      });
    });

    socket.close(1000, 'done');
    const whileClosing = socket.readyState;

    await ended;

    expect([whileOpen, whileClosing, socket.readyState]).toEqual([1, 2, 3]);
    client.close();
    await fixture.close();
  });

  it('should carry the negotiated protocol of an accepted socket', async () => {
    const fixture = await harness();
    const client = await opened(fixture.port);
    const socket = await fixture.accepted;

    expect(socket.protocol).toBe('');
    client.close();
    await fixture.close();
  });

  it('should deliver text, buffers and views the server sends', async () => {
    const fixture = await harness();
    const client = await opened(fixture.port);
    const socket = await fixture.accepted;

    socket.send('text');
    await expect(nextMessage(client)).resolves.toBe('text');
    socket.send(new TextEncoder().encode('buffer').buffer);
    await expect(nextMessage(client)).resolves.toBe('buffer');
    socket.send(new TextEncoder().encode('view'), { compress: false });
    await expect(nextMessage(client)).resolves.toBe('view');

    client.close();
    await fixture.close();
  });
});

describe('Listening to an accepted WebSocket', () => {
  it('should deliver the messages the client sends', async () => {
    const fixture = await harness();
    const client = await opened(fixture.port);
    const socket = await fixture.accepted;
    const received = new Promise<WebSocketData>((resolve) => {
      socket.on('message', (data) => {
        resolve(data);
      });
    });

    client.send('hello');
    const data = await received;

    expect(socketText(data)).toBe('hello');
    client.close();
    await fixture.close();
  });

  it('should stop delivering messages once the listener is dropped', async () => {
    const fixture = await harness();
    const client = await opened(fixture.port);
    const socket = await fixture.accepted;
    const seen: WebSocketData[] = [];
    const listener = (data: WebSocketData): void => {
      seen.push(data);
    };

    socket.on('message', listener);
    socket.off('message', listener);
    client.send('hello');
    await settled();

    expect(seen).toEqual([]);
    client.close();
    await fixture.close();
  });
});

describe('Ending an accepted WebSocket', () => {
  it('should report the code the client closed with', async () => {
    const fixture = await harness();
    const client = await opened(fixture.port);
    const socket = await fixture.accepted;
    const closed = new Promise<number>((resolve) => {
      socket.on('close', (code) => {
        resolve(code);
      });
    });

    client.close(1001, 'going away');

    await expect(closed).resolves.toBe(1001);
    await fixture.close();
  });

  it('should report a frame the socket cannot read as an error', async () => {
    const fixture = await harness();
    const client = await opened(fixture.port);
    const socket = await fixture.accepted;
    const failed = new Promise<unknown>((resolve) => {
      socket.on('error', (error) => {
        resolve(error);
      });
    });

    client.send(Buffer.from([0xc0, 0x80]), { binary: false });

    await expect(failed).resolves.toBeInstanceOf(Error);
    await fixture.close();
  });
});

describe('Announcing WebSocket handshake headers', () => {
  it('should let a header listener add to the handshake and then step away', async () => {
    const fixture = await harness();
    const seen: string[][] = [];
    const listener = (headers: string[]): void => {
      seen.push([...headers]);
    };

    fixture.server.on('headers', listener);
    const first = await opened(fixture.port);

    first.close();
    fixture.server.off('headers', listener);
    const second = await opened(fixture.port);

    second.close();
    expect(seen).toHaveLength(1);
    await fixture.close();
  });

  it('should ignore a header listener it never registered', async () => {
    const fixture = await harness();

    expect(fixture.server.off('headers', () => undefined)).toBe(fixture.server);
    await fixture.close();
  });
});

describe('Announcing an accepted connection', () => {
  it('should report that nobody listened for connections', async () => {
    const server = new NodeWebSocketServer();
    const http = createServer();
    const port = await boundPort(http);

    expect(server.options).toEqual({ noServer: true });
    server.close();
    http.close();
    expect(port).toBeGreaterThan(0);
  });
});
