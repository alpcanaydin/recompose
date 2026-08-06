import type { EngineGateway } from '@recompose/contracts';
import type { Context } from 'hono';

import { Hono } from 'hono';

import type { SpendGrantFor } from './gateway-proxy';
import type { ProxyDialect } from './gateway-wire';

import { countTokensAnswerFor, modelListing } from './gateway-discovery';
import { proxyModelRequest } from './gateway-proxy';
import { jsonResponse, readJsonBody, virtualNameOf } from './gateway-wire';
import { guardLoopback } from './loopback-guard';
import { unservedPath } from './refusals';

export type { SpendGrantFor } from './gateway-proxy';

const MODEL_ROUTES: readonly (readonly [string, ProxyDialect])[] = [
  ['/v1/messages', 'anthropic'],
  ['/messages', 'anthropic'],
  ['/v1/chat/completions', 'chat-completions'],
  ['/chat/completions', 'chat-completions'],
];

const COUNT_TOKENS_PATHS = ['/v1/messages/count_tokens', '/messages/count_tokens'];

async function countedTokens(c: Context, gateway: EngineGateway): Promise<Response> {
  const answer = countTokensAnswerFor(gateway, virtualNameOf(await readJsonBody(c)));

  return jsonResponse(answer.body, answer.status);
}

export function createGatewayApp(
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  fetchLike: typeof fetch = globalThis.fetch,
): Hono {
  const app = new Hono();

  app.use(guardLoopback(gateway.port));

  app.get('/health', (c) => c.json({ gateway: gateway.displayName }));
  app.get('/v1/models', (c) => c.json(modelListing(gateway.virtualModels)));

  for (const path of COUNT_TOKENS_PATHS) {
    app.post(path, async (c) => countedTokens(c, gateway));
  }

  for (const [path, dialect] of MODEL_ROUTES) {
    app.all(path, async (c) => proxyModelRequest(c, dialect, gateway, spendGrantFor, fetchLike));
  }

  app.notFound((c) => c.json(unservedPath(gateway.displayName, c.req.path), 404));

  return app;
}
