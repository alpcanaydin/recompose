import type { EngineGateway } from '@recompose/contracts';

import { Hono } from 'hono';

import type { SpendGrantFor, SubscriptionRuntime } from './gateway-proxy';
import type { ProxyDialect } from './gateway-wire';

import { proxyTokenCountRequest } from './gateway-count-tokens';
import { modelListing } from './gateway-discovery';
import { type ImagePath, proxyImageRequest } from './gateway-images';
import { proxyModelRequest, subscriptionRuntime } from './gateway-proxy';
import { proxyVideoRequest } from './gateway-videos';
import { registerGatewayWebSockets } from './gateway-websocket';
import { InvalidJsonBodyError, refusalResponse } from './gateway-wire';
import { guardLoopback } from './loopback-guard';
import { invalidJson, unservedPath } from './refusals';

export type { SpendGrantFor } from './gateway-proxy';

const MODEL_ROUTES: readonly (readonly [string, ProxyDialect])[] = [
  ['/v1/messages', 'anthropic'],
  ['/messages', 'anthropic'],
  ['/v1/chat/completions', 'chat-completions'],
  ['/chat/completions', 'chat-completions'],
  ['/v1/responses', 'responses'],
  ['/responses', 'responses'],
];

const COUNT_TOKENS_PATHS = ['/v1/messages/count_tokens', '/messages/count_tokens'];
const IMAGE_ROUTES: readonly (readonly [string, ImagePath])[] = [
  ['/v1/images/generations', '/images/generations'],
  ['/images/generations', '/images/generations'],
  ['/v1/images/edits', '/images/edits'],
  ['/images/edits', '/images/edits'],
];
const VIDEO_ROUTES = [
  ['/v1/videos/generations', '/videos/generations'],
  ['/videos/generations', '/videos/generations'],
  ['/v1/videos/edits', '/videos/edits'],
  ['/videos/edits', '/videos/edits'],
  ['/v1/videos/extensions', '/videos/extensions'],
  ['/videos/extensions', '/videos/extensions'],
  ['/v1/videos', ''],
  ['/videos', ''],
] as const;

function dialectForPath(path: string): ProxyDialect {
  if (path.endsWith('/responses')) {
    return 'responses';
  }

  return path.includes('/messages') ? 'anthropic' : 'chat-completions';
}

function registerImageRoutes(
  app: Hono,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  subscriptionServing: SubscriptionRuntime,
  fetchLike: typeof fetch,
): void {
  for (const [route, path] of IMAGE_ROUTES) {
    app.post(route, async (c) =>
      proxyImageRequest(c, gateway, path, spendGrantFor, subscriptionServing, fetchLike),
    );
  }
}

function registerVideoRoutes(
  app: Hono,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  fetchLike: typeof fetch,
): void {
  for (const [route, path] of VIDEO_ROUTES) {
    app.post(route, async (c) => proxyVideoRequest(c, gateway, path, spendGrantFor, fetchLike));
  }
}

export function createGatewayApp(
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  fetchLike: typeof fetch = globalThis.fetch,
  subscriptions?: SubscriptionRuntime,
): Hono {
  const app = new Hono();
  const subscriptionServing = subscriptions ?? subscriptionRuntime();

  app.use(guardLoopback(gateway.port));

  app.onError((error, c) => {
    if (error instanceof InvalidJsonBodyError) {
      return refusalResponse(dialectForPath(c.req.path), invalidJson(error.message));
    }

    throw error;
  });

  app.get('/health', (c) => c.json({ gateway: gateway.displayName }));
  app.get('/v1/models', (c) => c.json(modelListing(gateway.virtualModels)));
  registerGatewayWebSockets(app, gateway, spendGrantFor, fetchLike);

  for (const path of COUNT_TOKENS_PATHS) {
    app.post(path, async (c) =>
      proxyTokenCountRequest(c, gateway, spendGrantFor, subscriptionServing, fetchLike),
    );
  }

  registerImageRoutes(app, gateway, spendGrantFor, subscriptionServing, fetchLike);
  registerVideoRoutes(app, gateway, spendGrantFor, fetchLike);

  for (const [path, dialect] of MODEL_ROUTES) {
    app.all(path, async (c) =>
      proxyModelRequest(c, dialect, gateway, spendGrantFor, fetchLike, subscriptionServing),
    );
  }

  app.notFound((c) => c.json(unservedPath(gateway.displayName, c.req.path), 404));

  return app;
}
