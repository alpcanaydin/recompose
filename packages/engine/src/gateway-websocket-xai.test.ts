import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { expect, test } from 'vitest';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { openGatewayListeners } from './gateway-listener';
import { reserveFreePort } from './gateway-listener.testkit';
import { parsedJson } from './gateway-wire';

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
type UpstreamMode = 'success' | 'bare-error' | 'message-too-big' | 'handshake-429';

function deferred<T>(): Deferred<T> {
  let resolve = (_value: T): void => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

function rawText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString();
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data)).toString();

  return Buffer.from(data).toString();
}

function portOf(server: Server): number {
  const address = server.address();

  if (address === null || typeof address === 'string') throw new Error('upstream took no port');

  return address.port;
}

async function listen(server: Server): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve(portOf(server));
    });
  });
}

async function closeServer(server: Server, websocket: WebSocketServer): Promise<void> {
  for (const client of websocket.clients) client.terminate();
  websocket.close();

  return new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

function rejectFreeUsageHandshake(socket: import('node:stream').Duplex): void {
  const body = JSON.stringify({
    code: 'subscription:free-usage-exhausted',
    error: { code: 'subscription:free-usage-exhausted', message: 'free usage exhausted' },
  });

  socket.end(
    `HTTP/1.1 429 Too Many Requests\r\nContent-Type: application/json\r\nContent-Length: ${String(Buffer.byteLength(body))}\r\n\r\n${body}`,
  );
}

function respondUpstream(client: WebSocket, mode: UpstreamMode): void {
  if (mode === 'bare-error') {
    client.send(
      JSON.stringify({
        error: {
          message: 'Request validation error: {"code":"400","error":"unsupported arguments"}',
          type: 'api_error',
        },
      }),
    );
  } else if (mode === 'message-too-big') {
    client.close(1009, 'message too big');
  } else {
    client.send(JSON.stringify({ type: 'response.completed', response: { id: 'resp_1' } }));
  }
}

function attachUpstream(
  websocket: WebSocketServer,
  mode: UpstreamMode,
  received: Deferred<unknown>,
  disconnected: Deferred<void>,
): void {
  websocket.on('connection', (client) => {
    client.on('message', (data) => {
      received.resolve(parsedJson(rawText(data)));
      respondUpstream(client, mode);
    });
    client.once('close', () => {
      disconnected.resolve();
    });
  });
}

async function upstreamFixture(mode: UpstreamMode = 'success') {
  const received = deferred<unknown>();
  const disconnected = deferred<void>();
  const server = createServer();
  const websocket = new WebSocketServer({ noServer: true });
  let headers: IncomingHttpHeaders = {};
  let path = '';

  server.on('upgrade', (request, socket, head) => {
    path = request.url ?? '';
    headers = request.headers;

    if (mode === 'handshake-429') {
      rejectFreeUsageHandshake(socket);

      return;
    }

    websocket.handleUpgrade(request, socket, head, (client) => {
      websocket.emit('connection', client, request);
    });
  });
  attachUpstream(websocket, mode, received, disconnected);
  const port = await listen(server);

  return {
    origin: `http://127.0.0.1:${String(port)}/v1`,
    received,
    disconnected,
    request: () => ({ headers, path }),
    close: async () => closeServer(server, websocket),
  };
}

async function gatewayFixture(upstream: Awaited<ReturnType<typeof upstreamFixture>>) {
  const port = await reserveFreePort();
  const model = aVirtualModel({ target: { standing: 'bound', providerModel: 'grok-4.3' } });
  const grant = {
    verdict: 'resolved',
    providerOrigin: upstream.origin,
    spend: { custody: 'credentialed', provider: 'xai', credential: 'xai-ws-credential' },
  } as const;
  const app = createGatewayApp({ ...aGatewayHolding(model), port }, async () =>
    Promise.resolve(grant),
  );
  const listeners = await openGatewayListeners(app, port);

  if (!('opened' in listeners)) throw new Error('gateway WebSocket listener did not open');

  return { port, listeners: listeners.opened };
}

const payload = {
  type: 'response.create',
  model: 'fast',
  prompt_cache_key: 'ws-session',
  previous_response_id: 'resp_previous',
  instructions: 'drop on append',
  input: [{ role: 'user', content: 'hello' }],
  stream: true,
};

async function gatewayExchange(port: number, payload: unknown): Promise<unknown> {
  const client = new WebSocket(`ws://127.0.0.1:${String(port)}/v1/responses`);
  const downstream = deferred<unknown>();
  const failed = deferred<Error>();

  client.once('open', () => {
    client.send(JSON.stringify(payload));
  });
  client.once('message', (data) => {
    downstream.resolve(parsedJson(rawText(data)));
    client.close();
  });
  client.once('unexpected-response', (_request, response) => {
    let body = '';

    response.on('data', (chunk) => {
      body += Buffer.from(chunk).toString();
    });
    response.on('end', () => {
      failed.resolve(
        new Error(`gateway rejected WebSocket with ${String(response.statusCode)}: ${body}`),
      );
    });
  });

  return Promise.race([
    downstream.promise,
    failed.promise.then(async (error) => Promise.reject(error)),
  ]);
}

test('proxies a real xAI Responses WebSocket and closes its upstream lifecycle', async () => {
  const upstream = await upstreamFixture();
  const gateway = await gatewayFixture(upstream);

  await expect(gatewayExchange(gateway.port, payload)).resolves.toMatchObject({
    type: 'response.completed',
  });
  await expect(upstream.received.promise).resolves.toMatchObject({
    type: 'response.create',
    model: 'grok-4.3',
    store: true,
    prompt_cache_key: 'ws-session',
    previous_response_id: 'resp_previous',
  });
  expect(upstream.request().path).toBe('/v1/responses');
  expect(upstream.request().headers.authorization).toBe('Bearer xai-ws-credential');
  expect(upstream.request().headers['x-grok-conv-id']).toBe('ws-session');
  await upstream.disconnected.promise;
  await gateway.listeners.close();
  await upstream.close();
});

test.each([
  ['bare-error', 400, undefined],
  ['message-too-big', 413, 'message_too_big'],
  ['handshake-429', 429, 'subscription:free-usage-exhausted'],
] as const)('maps xAI WebSocket %s failures downstream', async (mode, status, code) => {
  const upstream = await upstreamFixture(mode);
  const gateway = await gatewayFixture(upstream);
  const result = await gatewayExchange(gateway.port, payload);

  expect(result).toMatchObject({ type: 'error', status });
  if (code !== undefined) expect(result).toHaveProperty('error.code', code);
  if (status === 429) expect(result).toHaveProperty('retry_after_seconds', 86_400);

  await gateway.listeners.close();
  await upstream.close();
});
