import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import { proxyFetchBoundMs } from '@recompose/contracts';

import type { SpendGrantFor } from './gateway-proxy';

import { isJsonObject, parsedJson } from './gateway-wire';
import { providerObservability, providerRequestId } from './provider/provider-observability';
import { parseSubscriptionCredential } from './subscription/credentials';

type JsonObject = Record<string, unknown>;
type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type AlphaAuth = { provider: string; credential: string; accountId?: string; path: string };

function objectBody(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null;
}

function sanitizedBody(body: JsonObject): JsonObject {
  const { prompt_cache_key: _key, prompt_cache_retention: _retention, ...sanitized } = body;

  return sanitized;
}

function virtualModelId(gateway: EngineGateway, body: JsonObject): string | null {
  const requested = body['model'];
  const exact =
    typeof requested === 'string'
      ? gateway.virtualModels.find((model) => model.id === requested)
      : undefined;

  return (exact ?? gateway.virtualModels[0])?.id ?? null;
}

function credentialedAlpha(grant: ResolvedGrant): AlphaAuth | null {
  const spend = grant.spend;

  return spend.custody === 'credentialed' && spend.provider === 'codex-alpha-search'
    ? { provider: spend.provider, credential: spend.credential, path: '/v1/alpha/search' }
    : null;
}

function subscriptionAlpha(grant: ResolvedGrant): AlphaAuth | null {
  const spend = grant.spend;

  if (spend.custody !== 'subscription' || spend.provider !== 'openai') return null;

  const credential = parseSubscriptionCredential('openai', spend.credential);

  return credential === null
    ? null
    : {
        provider: 'openai',
        credential: credential.accessToken,
        ...(credential.accountId === undefined ? {} : { accountId: credential.accountId }),
        path: '/alpha/search',
      };
}

function alphaCredential(grant: ResolvedGrant): AlphaAuth | null {
  return credentialedAlpha(grant) ?? subscriptionAlpha(grant);
}

function unavailable(c: Context, message: string): Response {
  return c.json({ error: message }, 503);
}

function requiredBody(raw: string): JsonObject {
  const body = objectBody(parsedJson(raw));

  if (body === null) throw new AlphaSearchError('Invalid search request', 400);

  return body;
}

function requiredVirtualModel(gateway: EngineGateway, body: JsonObject): string {
  const model = virtualModelId(gateway, body);

  if (model === null) throw new AlphaSearchError('Codex target unavailable', 503);

  return model;
}

class AlphaSearchError extends Error {
  public readonly status: 400 | 503;

  public constructor(message: string, status: 400 | 503) {
    super(message);
    this.status = status;
  }
}

async function resolvedGrant(
  c: Context,
  gateway: EngineGateway,
  body: JsonObject,
  virtualModel: string,
  spendGrantFor: SpendGrantFor,
): Promise<ResolvedGrant> {
  const sessionId = typeof body['id'] === 'string' ? body['id'] : undefined;
  const grant = await spendGrantFor(gateway.slug, virtualModel, {
    headers: new Headers(c.req.raw.headers),
    query: new URL(c.req.url).searchParams,
    ...(sessionId === undefined ? {} : { sessionId }),
  });

  if (grant.verdict !== 'resolved') throw new AlphaSearchError('Codex auth unavailable', 503);

  return grant;
}

function modelName(body: JsonObject, fallback: string): string {
  return typeof body['model'] === 'string' ? body['model'] : fallback;
}

function accountId(grant: ResolvedGrant): string | undefined {
  return grant.spend.custody === 'open' ? undefined : grant.spend.accountId;
}

async function forwardedSearch(
  body: JsonObject,
  virtualModel: string,
  grant: ResolvedGrant,
  fetchLike: typeof fetch,
  sourceHeaders: Headers,
): Promise<Response> {
  const auth = alphaCredential(grant);
  const origin = grant.providerOrigin.trim().replace(/\/+$/u, '');

  if (auth === null || origin === '') {
    throw new AlphaSearchError('Codex alpha search unavailable', 503);
  }

  const payload = JSON.stringify(sanitizedBody(body));
  const url = `${origin}${auth.path}`;
  const headers = new Headers({
    Authorization: `Bearer ${auth.credential}`,
    'Content-Type': 'application/json',
  });
  const sessionHeader = sourceHeaders.get('session_id');

  if (sessionHeader !== null) headers.set('Session_id', sessionHeader);
  if (auth.accountId !== undefined) headers.set('Chatgpt-Account-Id', auth.accountId);
  const span = providerObservability().start({
    provider: auth.provider,
    model: modelName(body, virtualModel),
    accountId: accountId(grant),
    dialect: 'responses',
    method: 'POST',
    requestId: providerRequestId(headers),
  });
  const response = await fetchLike(url, {
    method: 'POST',
    headers,
    body: payload,
    signal: AbortSignal.timeout(proxyFetchBoundMs),
  });

  return span.observe(response);
}

export async function proxyCodexAlphaSearch(
  c: Context,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  fetchLike: typeof fetch,
): Promise<Response> {
  try {
    const body = requiredBody(await c.req.text());
    const virtualModel = requiredVirtualModel(gateway, body);
    const grant = await resolvedGrant(c, gateway, body, virtualModel, spendGrantFor);

    return await forwardedSearch(
      body,
      virtualModel,
      grant,
      fetchLike,
      new Headers(c.req.raw.headers),
    );
  } catch (failure) {
    if (failure instanceof AlphaSearchError) {
      return failure.status === 400
        ? c.json({ error: failure.message }, 400)
        : unavailable(c, failure.message);
    }

    throw failure;
  }
}
