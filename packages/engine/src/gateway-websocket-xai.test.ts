import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { expect, test } from 'vitest';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { openGatewayListeners } from './gateway-listener';
import { reserveFreePort } from './gateway-listener.testkit';
import { parsedJson } from './gateway-wire';

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

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

async function upstreamFixture() {
  const received = deferred<unknown>();
  const disconnected = deferred<void>();
  const server = createServer();
  const websocket = new WebSocketServer({ noServer: true });
  let headers: IncomingHttpHeaders = {};
  let path = '';

  server.on('upgrade', (request, socket, head) => {
    path = request.url ?? '';
    headers = request.headers;
    websocket.handleUpgrade(request, socket, head, (client) => {
      websocket.emit('connection', client, request);
    });
  });
  websocket.on('connection', (client) => {
    client.on('message', (data) => {
      received.resolve(parsedJson(rawText(data)));
      client.send(JSON.stringify({ type: 'response.completed', response: { id: 'resp_1' } }));
    });
    client.once('close', () => {
      disconnected.resolve();
    });
  });
  const port = await listen(server);

  return {
    origin: `http://127.0.0.1:${String(port)}/v1`,
    received,
    disconnected,
    request: () => ({ headers, path }),
    close: async () => closeServer(server, websocket),
  };
}

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
  const gatewayPort = await reserveFreePort();
  const model = aVirtualModel({ target: { standing: 'bound', providerModel: 'grok-4.3' } });
  const grant = {
    verdict: 'resolved',
    providerOrigin: upstream.origin,
    spend: { custody: 'credentialed', provider: 'xai', credential: 'xai-ws-credential' },
  } as const;
  const app = createGatewayApp({ ...aGatewayHolding(model), port: gatewayPort }, async () =>
    Promise.resolve(grant),
  );
  const listeners = await openGatewayListeners(app, gatewayPort);

  if (!('opened' in listeners)) throw new Error('gateway WebSocket listener did not open');

  const payload = {
    type: 'response.create',
    model: 'fast',
    prompt_cache_key: 'ws-session',
    previous_response_id: 'resp_previous',
    instructions: 'drop on append',
    input: [{ role: 'user', content: 'hello' }],
    stream: true,
  };

  await expect(gatewayExchange(gatewayPort, payload)).resolves.toMatchObject({
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
  await listeners.opened.close();
  await upstream.close();
});
