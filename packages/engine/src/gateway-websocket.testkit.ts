import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { openGatewayListeners } from './gateway-listener';
import { reserveFreePort } from './gateway-listener.testkit';
import {
  rejectFreeUsageHandshake,
  respondUpstream,
  type UpstreamMode,
} from './gateway-websocket-upstream.testkit';
import { parsedJson } from './gateway-wire';
import { xaiWebSocketText } from './provider/xai-websocket-wire';

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
type UpstreamStats = { connections: number; messages: unknown[]; compactBodies: unknown[] };

function deferred<T>(): Deferred<T> {
  let resolve = (_value: T): void => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
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

function attachUpstream(
  websocket: WebSocketServer,
  mode: UpstreamMode,
  received: Deferred<unknown>,
  disconnected: Deferred<void>,
  stats: UpstreamStats,
): void {
  websocket.on('connection', (client) => {
    stats.connections += 1;
    client.on('message', (data) => {
      const message = parsedJson(xaiWebSocketText(data));

      stats.messages.push(message);
      received.resolve(message);
      respondUpstream(client, mode, message);
    });
    client.once('close', () => {
      disconnected.resolve();
    });
  });
}

async function requestText(request: IncomingMessage): Promise<string> {
  request.setEncoding('utf8');

  return new Promise<string>((resolve, reject) => {
    let text = '';

    request.on('data', (chunk: string) => {
      text += chunk;
    });
    request.once('end', () => {
      resolve(text);
    });
    request.once('error', reject);
  });
}

async function handleCompact(
  request: IncomingMessage,
  response: ServerResponse,
  stats: UpstreamStats,
): Promise<void> {
  if (request.url !== '/v1/responses/compact') {
    response.writeHead(404).end();

    return;
  }

  stats.compactBodies.push(parsedJson(await requestText(request)));
  const encrypted = Buffer.alloc(256, 9).toString('base64').replace(/=+$/u, '');

  response.setHeader('content-type', 'application/json');
  response.end(
    JSON.stringify({
      id: 'resp_compact',
      model: 'grok-4.3',
      output: [{ type: 'compaction', encrypted_content: encrypted }],
    }),
  );
}

export async function upstreamFixture(mode: UpstreamMode = 'success') {
  const received = deferred<unknown>();
  const disconnected = deferred<void>();
  const stats: UpstreamStats = { connections: 0, messages: [], compactBodies: [] };
  const server = createServer((request, response) => {
    void handleCompact(request, response, stats);
  });
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
  attachUpstream(websocket, mode, received, disconnected, stats);
  const port = await listen(server);

  return {
    origin: `http://127.0.0.1:${String(port)}/v1`,
    received,
    disconnected,
    stats,
    request: () => ({ headers, path }),
    close: async () => closeServer(server, websocket),
  };
}

export async function gatewayFixture(
  upstream: Awaited<ReturnType<typeof upstreamFixture>>,
  alternate?: Awaited<ReturnType<typeof upstreamFixture>>,
) {
  const port = await reserveFreePort();
  const model = aVirtualModel({ target: { standing: 'bound', providerModel: 'grok-4.3' } });
  const wide = aVirtualModel({
    id: 'wide',
    target: { standing: 'bound', providerModel: 'grok-4.5' },
  });
  const app = createGatewayApp(
    { ...aGatewayHolding(model, wide), port },
    async (_slug, virtualModel) =>
      Promise.resolve({
        verdict: 'resolved',
        providerOrigin:
          virtualModel === 'wide' && alternate !== undefined ? alternate.origin : upstream.origin,
        spend: {
          custody: 'credentialed',
          provider: 'xai',
          credential: virtualModel === 'wide' ? 'alternate-credential' : 'xai-ws-credential',
        },
      }),
  );
  const listeners = await openGatewayListeners(app, port);

  if (!('opened' in listeners)) throw new Error('gateway WebSocket listener did not open');

  return { port, listeners: listeners.opened };
}

export const xaiWebSocketPayload = {
  type: 'response.create',
  model: 'fast',
  prompt_cache_key: 'ws-session',
  previous_response_id: 'resp_previous',
  instructions: 'drop on append',
  input: [{ role: 'user', content: 'hello' }],
  stream: true,
};

export async function gatewayConversation(port: number, payloads: unknown[]): Promise<unknown[]> {
  return gatewayScript(
    port,
    payloads.map((payload) => ({ payload, answers: 1 })),
  );
}

export async function gatewayScript(
  port: number,
  steps: Array<{ payload: unknown; answers: number }>,
): Promise<unknown[]> {
  const client = new WebSocket(`ws://127.0.0.1:${String(port)}/v1/responses`);
  const completed = deferred<unknown[]>();
  const answers: unknown[] = [];
  let stepIndex = 0;
  let stepAnswers = 0;

  const sendNext = (): void => {
    client.send(JSON.stringify(steps[stepIndex]?.payload));
    stepAnswers = 0;
  };

  client.once('open', sendNext);
  client.on('message', (data) => {
    answers.push(parsedJson(xaiWebSocketText(data)));
    stepAnswers += 1;

    if (stepAnswers < (steps[stepIndex]?.answers ?? 0)) return;

    stepIndex += 1;

    if (stepIndex < steps.length) sendNext();
    else {
      completed.resolve(answers);
      client.close();
    }
  });

  return completed.promise;
}

export async function gatewayExchange(port: number, payload: unknown): Promise<unknown> {
  const client = new WebSocket(`ws://127.0.0.1:${String(port)}/v1/responses`);
  const downstream = deferred<unknown>();
  const failed = deferred<Error>();

  client.once('open', () => {
    client.send(JSON.stringify(payload));
  });
  client.once('message', (data) => {
    downstream.resolve(parsedJson(xaiWebSocketText(data)));
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
