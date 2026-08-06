import type { EngineGateway, EngineVirtualModel, SpendGrant } from '@recompose/contracts';
import type { Hono } from 'hono';

import { getRequestListener } from '@hono/node-server';
import { createServer } from 'node:http';

import type { OpenListeners } from './engine-runtime';
import type { SpendGrantFor } from './gateway-app';

export function aVirtualModel(overrides: Partial<EngineVirtualModel> = {}): EngineVirtualModel {
  return {
    id: 'fast',
    displayName: 'Fast',
    target: { standing: 'bound', providerModel: 'gpt-5-mini' },
    ...overrides,
  };
}

export function aGatewayHolding(...virtualModels: readonly EngineVirtualModel[]): EngineGateway {
  return { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [...virtualModels] };
}

export type AskedGrants = {
  asked: { slug: string; virtualModel: string }[];
  grantFor: SpendGrantFor;
};

export function granting(grant: SpendGrant): AskedGrants {
  const asked: { slug: string; virtualModel: string }[] = [];

  return {
    asked,
    grantFor: async (slug, virtualModel) => {
      asked.push({ slug, virtualModel });

      return Promise.resolve(grant);
    },
  };
}

export const grantsNothing: SpendGrantFor = async () =>
  Promise.resolve({ verdict: 'missing-target' });

export function aCredentialedGrant(
  providerOrigin = 'http://127.0.0.1:4242',
  provider = 'openai',
): SpendGrant {
  return {
    verdict: 'resolved',
    providerOrigin,
    spend: { custody: 'credentialed', provider, credential: 'sk-live-40d1' },
  };
}

export function anOpenGrant(providerOrigin = 'http://127.0.0.1:4242'): SpendGrant {
  return { verdict: 'resolved', providerOrigin, spend: { custody: 'open' } };
}

export function aGrantAnswering(id: string, providerOrigin: string): unknown {
  return { kind: 'spend-grant', answers: id, grant: aCredentialedGrant(providerOrigin) };
}

export const neverFetches: typeof fetch = async () =>
  Promise.reject(new Error('no request may leave the machine'));

export type SentRequest = { url: string; init: RequestInit | undefined };

function requestUrlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

export function fetchAnsweringWith(answer: () => Response): {
  sent: SentRequest[];
  fetchLike: typeof fetch;
} {
  const sent: SentRequest[] = [];

  const fetchLike: typeof fetch = async (input, init) => {
    sent.push({ url: requestUrlOf(input), init });

    return Promise.resolve(answer());
  };

  return { sent, fetchLike };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sentBodyText(sent: readonly SentRequest[], at: number): string {
  const body = sent.at(at)?.init?.body;

  if (typeof body !== 'string') {
    throw new Error('the outbound request carried no body to read');
  }

  return body;
}

export function bodySentIn(sent: readonly SentRequest[], at = 0): Record<string, unknown> {
  const parsed: unknown = JSON.parse(sentBodyText(sent, at));

  if (!isRecord(parsed)) {
    throw new Error('the outbound request carried no JSON object');
  }

  return parsed;
}

export function headersSentIn(sent: readonly SentRequest[], at = 0): Headers {
  return new Headers(sent.at(at)?.init?.headers);
}

export function aLoopbackCapturing(): { apps: Hono[]; openListeners: OpenListeners } {
  const apps: Hono[] = [];

  return {
    apps,
    openListeners: async (app) => {
      apps.push(app);

      return Promise.resolve({ opened: { close: async () => Promise.resolve() } });
    },
  };
}

export function openedApp(capturing: { apps: Hono[] }): Hono {
  const app = capturing.apps.at(0);

  if (app === undefined) {
    throw new Error('no gateway app was opened');
  }

  return app;
}

export type RunningOrigin = { origin: string; close: () => Promise<void> };

export async function servedOrigin(app: Hono): Promise<RunningOrigin> {
  const answer = getRequestListener(app.fetch);
  const server = createServer((incoming, outgoing) => {
    void answer(incoming, outgoing);
  });

  await new Promise<void>((ready) => {
    server.listen({ port: 0, host: '127.0.0.1' }, ready);
  });

  const bound = server.address();
  const port = bound !== null && typeof bound === 'object' ? bound.port : 0;

  return {
    origin: `http://127.0.0.1:${String(port)}`,
    close: async () =>
      new Promise<void>((closed) => {
        server.closeAllConnections();
        server.close(() => {
          closed();
        });
      }),
  };
}

export function sseText(payloads: readonly string[]): string {
  return payloads.map((payload) => `data: ${payload}\n\n`).join('');
}

export async function readSseData(response: Response): Promise<string[]> {
  const text = await response.text();

  return text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length));
}

export type SseEvent = { event: string | undefined; data: string };

function sseEventOf(block: string): SseEvent {
  const lines = block.split('\n');

  return {
    event: lines.find((line) => line.startsWith('event: '))?.slice('event: '.length),
    data: lines.find((line) => line.startsWith('data: '))?.slice('data: '.length) ?? '',
  };
}

export async function readSseEvents(response: Response): Promise<SseEvent[]> {
  const text = await response.text();

  return text
    .split('\n\n')
    .filter((block) => block.includes('data: '))
    .map(sseEventOf);
}

export function parsedEvents(payloads: readonly string[]): unknown[] {
  return payloads.map((payload) => {
    const parsed: unknown = JSON.parse(payload);

    return parsed;
  });
}

export function aHeldStream(): {
  stream: ReadableStream<Uint8Array>;
  send: (text: string) => void;
  sendBytes: (bytes: Uint8Array) => void;
  end: () => void;
  die: () => void;
} {
  const encoder = new TextEncoder();
  let control: ReadableStreamDefaultController<Uint8Array> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      control = controller;
    },
  });

  return {
    stream,
    send: (text) => {
      control?.enqueue(encoder.encode(text));
    },
    sendBytes: (bytes) => {
      control?.enqueue(bytes);
    },
    end: () => {
      control?.close();
    },
    die: () => {
      control?.error(new Error('the provider connection died'));
    },
  };
}
