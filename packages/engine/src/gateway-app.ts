import type { EngineGateway } from '@recompose/contracts';

import { Hono } from 'hono';

import type { SpendGrantFor, SubscriptionRuntime } from './gateway-proxy';
import type { ProxyDialect } from './gateway-wire';
import type { PluginHost } from './plugin-host';
import type { ProviderLogStore } from './provider/provider-log-store';

import { proxyCodexAlphaSearch } from './gateway-codex-alpha-search';
import { proxyCodexCompactRequest } from './gateway-codex-compact';
import { proxyTokenCountRequest } from './gateway-count-tokens';
import { modelListing } from './gateway-discovery';
import { type ImagePath, proxyImageRequest } from './gateway-images';
import { proxyModelRequest, subscriptionRuntime } from './gateway-proxy';
import { proxyVideoRequest } from './gateway-videos';
import { registerGatewayWebSockets } from './gateway-websocket';
import { InvalidJsonBodyError, refusalResponse } from './gateway-wire';
import { guardLoopback } from './loopback-guard';
import { registerManagementLogs } from './management-logs';
import { registerManagementUsage } from './management-usage';
import { type AIStudioRelay, aiStudioRelayRuntime } from './provider/ai-studio-relay';
import {
  configuredProviderLogStore,
  persistProviderObservations,
} from './provider/provider-log-runtime';
import { invalidJson, unservedPath } from './refusals';

export type { SpendGrantFor } from './gateway-proxy';

const MODEL_ROUTES: readonly (readonly [string, ProxyDialect])[] = [
  ['/v1/messages', 'anthropic'],
  ['/messages', 'anthropic'],
  ['/v1/chat/completions', 'chat-completions'],
  ['/chat/completions', 'chat-completions'],
  ['/v1/responses', 'responses'],
  ['/responses', 'responses'],
  ['/v1/interactions', 'interactions'],
  ['/v1beta/interactions', 'interactions'],
  ['/interactions', 'interactions'],
];

const GEMINI_MODEL_ROUTE = '/v1beta/models/:action{.+}';
const generateContentSuffix = ':generateContent';
const streamGenerateContentSuffix = ':streamGenerateContent';

const COUNT_TOKENS_PATHS = ['/v1/messages/count_tokens', '/messages/count_tokens'];
const COMPACT_PATHS = ['/v1/responses/compact', '/responses/compact'];
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

function chosenAIStudioRelay(relay?: AIStudioRelay): AIStudioRelay {
  return relay ?? aiStudioRelayRuntime();
}

function preparedLogStore(store?: ProviderLogStore): ProviderLogStore | null {
  const selected = store ?? configuredProviderLogStore();

  if (selected !== null) persistProviderObservations(selected);

  return selected;
}

function dialectForPath(path: string): ProxyDialect {
  if (isGeminiModelPath(path)) return 'gemini';

  if (path.endsWith('/interactions')) {
    return 'interactions';
  }

  if (path.endsWith('/responses')) {
    return 'responses';
  }

  return defaultDialectForPath(path);
}

function isGeminiModelPath(path: string): boolean {
  return path.includes('/models/') && path.includes('generateContent');
}

function defaultDialectForPath(path: string): ProxyDialect {
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

function registerCountRoutes(
  app: Hono,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  subscriptions: SubscriptionRuntime,
  fetchLike: typeof fetch,
  relay: AIStudioRelay,
  plugins?: PluginHost,
): void {
  for (const path of COUNT_TOKENS_PATHS) {
    app.post(path, async (c) =>
      proxyTokenCountRequest(c, gateway, spendGrantFor, subscriptions, fetchLike, relay, plugins),
    );
  }
}

function registerCompactRoutes(
  app: Hono,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  subscriptions: SubscriptionRuntime,
  fetchLike: typeof fetch,
): void {
  for (const path of COMPACT_PATHS) {
    app.post(path, async (c) =>
      proxyCodexCompactRequest(c, gateway, spendGrantFor, subscriptions, fetchLike),
    );
  }
}

function registerModelRoutes(
  app: Hono,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  subscriptions: SubscriptionRuntime,
  fetchLike: typeof fetch,
  relay: AIStudioRelay,
  plugins?: PluginHost,
): void {
  for (const [path, dialect] of MODEL_ROUTES) {
    app.all(path, async (c) =>
      proxyModelRequest(
        c,
        dialect,
        gateway,
        spendGrantFor,
        fetchLike,
        subscriptions,
        relay,
        plugins,
      ),
    );
  }

  registerGeminiModelRoutes(app, gateway, spendGrantFor, subscriptions, fetchLike, relay, plugins);
}

function registerGeminiModelRoutes(
  app: Hono,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  subscriptions: SubscriptionRuntime,
  fetchLike: typeof fetch,
  relay: AIStudioRelay,
  plugins?: PluginHost,
): void {
  app.post(GEMINI_MODEL_ROUTE, async (c) =>
    proxyGeminiAction(
      c,
      c.req.param('action'),
      gateway,
      spendGrantFor,
      subscriptions,
      fetchLike,
      relay,
      plugins,
    ),
  );
}

type GeminiAction = { model: string; stream: boolean };

function parsedGeminiAction(action: string): GeminiAction | null {
  if (action.endsWith(streamGenerateContentSuffix)) {
    return { model: action.slice(0, -streamGenerateContentSuffix.length), stream: true };
  }

  return action.endsWith(generateContentSuffix)
    ? { model: action.slice(0, -generateContentSuffix.length), stream: false }
    : null;
}

async function proxyGeminiAction(
  c: Parameters<typeof proxyModelRequest>[0],
  action: string,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  subscriptions: SubscriptionRuntime,
  fetchLike: typeof fetch,
  relay: AIStudioRelay,
  plugins?: PluginHost,
): Promise<Response> {
  const parsed = parsedGeminiAction(action);

  if (parsed === null) return c.json(unservedPath(gateway.displayName, c.req.path), 404);

  return proxyModelRequest(
    c,
    'gemini',
    gateway,
    spendGrantFor,
    fetchLike,
    subscriptions,
    relay,
    plugins,
    parsed.model,
    parsed.stream,
  );
}

export function createGatewayApp(
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  fetchLike: typeof fetch = globalThis.fetch,
  subscriptions?: SubscriptionRuntime,
  aiStudio?: AIStudioRelay,
  providerLogs?: ProviderLogStore,
  plugins?: PluginHost,
): Hono {
  const app = new Hono();
  const subscriptionServing = subscriptions ?? subscriptionRuntime();
  const relay = chosenAIStudioRelay(aiStudio);
  const logStore = preparedLogStore(providerLogs);

  app.use(guardLoopback(gateway.port));

  app.onError((error, c) => {
    if (error instanceof InvalidJsonBodyError) {
      return refusalResponse(dialectForPath(c.req.path), invalidJson(error.message));
    }

    throw error;
  });

  app.get('/health', (c) => c.json({ gateway: gateway.displayName }));
  app.on(['GET', 'HEAD'], '/healthz', (c) =>
    c.req.method === 'HEAD' ? c.body(null, 200) : c.json({ status: 'ok' }),
  );
  app.get('/v1/models', (c) => c.json(modelListing(gateway.virtualModels)));
  registerManagementUsage(app);
  registerManagementLogs(app, logStore);
  registerGatewayWebSockets(app, gateway, spendGrantFor, fetchLike, relay);
  app.post('/v1/alpha/search', async (c) =>
    proxyCodexAlphaSearch(c, gateway, spendGrantFor, fetchLike),
  );
  app.post('/backend-api/codex/alpha/search', async (c) =>
    proxyCodexAlphaSearch(c, gateway, spendGrantFor, fetchLike),
  );

  registerCountRoutes(app, gateway, spendGrantFor, subscriptionServing, fetchLike, relay, plugins);
  registerCompactRoutes(app, gateway, spendGrantFor, subscriptionServing, fetchLike);

  registerImageRoutes(app, gateway, spendGrantFor, subscriptionServing, fetchLike);
  registerVideoRoutes(app, gateway, spendGrantFor, fetchLike);

  registerModelRoutes(app, gateway, spendGrantFor, subscriptionServing, fetchLike, relay, plugins);

  app.notFound((c) => c.json(unservedPath(gateway.displayName, c.req.path), 404));

  return app;
}
