import { expect, test } from 'vitest';
import { WebSocket, type RawData } from 'ws';

import type { CodexSocket, CodexWebSocketLifecycle, CodexWebSocketTurn } from './codex-websocket';

import { CodexWebSocketExecutor } from './codex-websocket';

const COMPLETED = '{"type":"response.completed","response":{"id":"resp-1"}}';

type SocketScript = (socket: ScriptedSocket) => void;

class ScriptedSocket implements CodexSocket {
  public readyState: number = WebSocket.OPEN;
  public readonly closeReasons: string[] = [];
  private readonly script: SocketScript;
  private readonly messages: ((data: RawData) => void)[] = [];
  private readonly closes: ((code: number, reason: Buffer) => void)[] = [];
  private readonly errors: ((error: Error) => void)[] = [];

  public constructor(script: SocketScript) {
    this.script = script;
  }

  public send(_data: string): void {
    queueMicrotask(() => {
      this.script(this);
    });
  }

  public close(_code?: number, reason = ''): void {
    this.readyState = WebSocket.CLOSED;
    this.closeReasons.push(reason);
  }

  public onMessage(listener: (data: RawData) => void): void {
    this.messages.push(listener);
  }

  public onClose(listener: (code: number, reason: Buffer) => void): void {
    this.closes.push(listener);
  }

  public onError(listener: (error: Error) => void): void {
    this.errors.push(listener);
  }

  public deliver(payload: string): void {
    for (const listener of this.messages) listener(Buffer.from(payload));
  }

  public shutUpstream(reason: string): void {
    for (const listener of this.closes) listener(1006, Buffer.from(reason));
  }

  public failUpstream(error: Error): void {
    for (const listener of this.errors) listener(error);
  }
}

class RecordingLifecycle implements CodexWebSocketLifecycle {
  public readonly ends: string[] = [];
  private closeConnection: (() => void) | undefined;

  public bind(close: () => void): void {
    this.closeConnection = close;
  }

  public end(reason: string): void {
    this.ends.push(reason);
  }

  public endNow(): void {
    this.closeConnection?.();
  }
}

function turn(overrides: Partial<CodexWebSocketTurn> = {}): CodexWebSocketTurn {
  return {
    sessionId: 'session-1',
    authId: 'auth-1',
    baseUrl: 'https://api.example.test/v1',
    headers: { authorization: 'Bearer token' },
    body: { type: 'response.create', model: 'gpt-5.4' },
    downstream: () => undefined,
    ...overrides,
  };
}

function scriptedExecutor(script: SocketScript) {
  const sockets: ScriptedSocket[] = [];
  const executor = new CodexWebSocketExecutor(async () => {
    const socket = new ScriptedSocket(script);

    sockets.push(socket);

    return Promise.resolve(socket);
  });

  return { executor, sockets };
}

function completingExecutor() {
  return scriptedExecutor((socket) => {
    socket.deliver(COMPLETED);
  });
}

test('rejects the active turn when the upstream closes without naming a reason', async () => {
  const fixture = scriptedExecutor((socket) => {
    socket.shutUpstream('');
  });

  await expect(fixture.executor.execute(turn())).rejects.toThrow('upstream closed');
});

test('rejects the active turn when the upstream socket fails', async () => {
  const fixture = scriptedExecutor((socket) => {
    socket.failUpstream(new Error('socket exploded'));
  });

  await expect(fixture.executor.execute(turn())).rejects.toThrow('socket exploded');
});

test('passes an interim payload downstream and keeps the turn open', async () => {
  const delta = '{"type":"response.output_text.delta","delta":"hi"}';
  const seen: string[] = [];
  const fixture = scriptedExecutor((socket) => {
    socket.deliver(delta);
    socket.deliver(COMPLETED);
  });

  await fixture.executor.execute(
    turn({
      downstream: (payload) => {
        seen.push(payload);
      },
    }),
  );

  expect(seen).toEqual([delta, COMPLETED]);
});

test('ignores an upstream payload that arrives after the turn completed', async () => {
  const seen: string[] = [];
  const fixture = completingExecutor();

  await fixture.executor.execute(
    turn({
      downstream: (payload) => {
        seen.push(payload);
      },
    }),
  );
  fixture.sockets[0]?.deliver('{"type":"response.output_text.delta"}');

  expect(seen).toEqual([COMPLETED]);
});

test('closing a session ends its lifecycle and drops its connection', async () => {
  const lifecycle = new RecordingLifecycle();
  const fixture = completingExecutor();

  await fixture.executor.execute(turn({ lifecycle }));
  fixture.executor.closeSession('session-1');

  expect(lifecycle.ends).toEqual(['session closed']);

  await fixture.executor.execute(turn());

  expect(fixture.sockets).toHaveLength(2);
});

test('closing the executor ends every live session', async () => {
  const lifecycle = new RecordingLifecycle();
  const fixture = completingExecutor();

  await fixture.executor.execute(turn({ lifecycle }));
  fixture.executor.closeAll();

  expect(lifecycle.ends).toEqual(['executor closed']);
  expect(fixture.sockets[0]?.closeReasons).toEqual(['executor closed']);
});

test('a lifecycle that ends closes the connection it was bound to', async () => {
  const lifecycle = new RecordingLifecycle();
  const fixture = completingExecutor();

  await fixture.executor.execute(turn({ lifecycle }));
  lifecycle.endNow();

  expect(lifecycle.ends).toEqual(['lifecycle ended']);
  expect(fixture.sockets[0]?.closeReasons).toEqual(['lifecycle ended']);
});
