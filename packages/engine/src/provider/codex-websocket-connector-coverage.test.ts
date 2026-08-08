import { expect, test } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';

import {
  CodexIdentityConfusion,
  codexResponsesWebSocketUrl,
  codexSocketText,
  codexWebSocketProxyURL,
  defaultCodexConnector,
  sanitizeCodexWebSocketBody,
} from './codex-websocket-connector';

type LiveServer = { url: string; server: WebSocketServer; close: () => Promise<void> };

async function listening(options: Record<string, unknown> = {}): Promise<LiveServer> {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0, ...options });

  await new Promise<void>((resolve) => {
    server.once('listening', resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  return {
    url: `ws://127.0.0.1:${String(port)}`,
    server,
    close: async () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

test('turns a plain HTTP origin into a WebSocket responses endpoint', () => {
  expect(codexResponsesWebSocketUrl('http://api.example.test/v1/')).toBe(
    'ws://api.example.test/v1/responses',
  );
});

test('leaves input items that carry no usable identifier untouched', () => {
  const body = sanitizeCodexWebSocketBody({
    input: [
      'text',
      { type: 'message' },
      { type: 'message', id: 7 },
      { type: 'message', id: 'msg' },
    ],
  });

  expect(body['input']).toEqual([
    'text',
    { type: 'message' },
    { type: 'message', id: 7 },
    { type: 'message', id: 'msg' },
  ]);
});

test('prefers the account proxy over the global proxy', () => {
  expect(codexWebSocketProxyURL('http://account.proxy', 'http://global.proxy')).toBe(
    'http://account.proxy',
  );
  expect(codexWebSocketProxyURL(undefined, undefined)).toBeNull();
});

test('returns an unmapped identity value as it arrived', () => {
  expect(new CodexIdentityConfusion('auth-1').restore('never-mapped')).toBe('never-mapped');
});

test('leaves a request that names no prompt cache key alone', () => {
  const identity = new CodexIdentityConfusion('auth-1');
  const request = identity.request({ model: 'gpt-5.4' }, { authorization: 'Bearer token' });

  expect(request.body).toEqual({ model: 'gpt-5.4' });
  expect(request.headers).toEqual({ authorization: 'Bearer token' });
});

test('leaves a response that carries no restorable identifier alone', () => {
  const identity = new CodexIdentityConfusion('auth-1');

  expect(identity.response('text')).toBe('text');
  expect(identity.response({ response: { id: 7 } })).toEqual({ response: { id: 7 } });
});

test('carries messages both ways over a live upstream socket', async () => {
  const live = await listening();

  live.server.on('connection', (upstream) => {
    upstream.on('message', (data: Buffer) => {
      upstream.send(`echo:${data.toString('utf8')}`);
    });
  });

  try {
    const socket = await defaultCodexConnector(live.url, { authorization: 'Bearer token' });
    const echoed = new Promise<string>((resolve) => {
      socket.onMessage((data) => {
        resolve(codexSocketText(data));
      });
    });

    socket.onError(() => undefined);

    expect(socket.readyState).toBe(WebSocket.OPEN);
    socket.send('ping');

    await expect(echoed).resolves.toBe('echo:ping');

    const closed = new Promise<number>((resolve) => {
      socket.onClose((code) => {
        resolve(code);
      });
    });

    socket.close(1000, 'done');

    await expect(closed).resolves.toBe(1000);
  } finally {
    await live.close();
  }
});

test('reports the handshake status when the upstream refuses the upgrade', async () => {
  const live = await listening({ verifyClient: () => false });

  try {
    await expect(defaultCodexConnector(live.url, {})).rejects.toMatchObject({
      name: 'CodexWebSocketError',
      status: 401,
    });
  } finally {
    await live.close();
  }
});

test('rejects when the upstream cannot be reached at all', async () => {
  await expect(defaultCodexConnector('ws://127.0.0.1:1', {})).rejects.toThrow();
});
