import type { EngineGateway, EngineVirtualModel, SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import type { SpendGrantFor, SubscriptionRuntime } from './gateway-proxy';
import type { JsonObject } from './gateway-wire';

import { translateRequest } from './dialect/dispatcher';
import { translateRequestToGemini } from './dialect/gemini-bridge';
import {
  ingressPayload,
  isJsonObject,
  jsonResponse,
  readJsonBody,
  refusalResponse,
  requestSessionId,
} from './gateway-wire';
import { emptyConversation, missingCredential, missingTarget, unknownModel } from './refusals';
import { parseSubscriptionCredential } from './subscription/credentials';
import { reachAntigravityCount, reachSubscriptionCount } from './subscription/reach-count';
import { countClaudeInputTokens, countCodexInputTokens } from './token-count';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

function malformedSubscription(grant: ResolvedGrant): boolean {
  return (
    grant.spend.custody === 'subscription' &&
    parseSubscriptionCredential(grant.spend.provider, grant.spend.credential) === null
  );
}

function deniedCount(
  gateway: EngineGateway,
  model: string,
  grant: SpendGrant,
): Response | undefined {
  if (grant.verdict === 'missing-target') {
    return refusalResponse('anthropic', missingTarget(gateway.displayName, model));
  }

  if (grant.verdict === 'missing-credential' || malformedSubscription(grant)) {
    return refusalResponse('anthropic', missingCredential(gateway.displayName, model));
  }

  return undefined;
}

function codexCountBody(raw: JsonObject, providerModel: string): JsonObject | null {
  const payload = ingressPayload('anthropic', raw);

  if (payload === null) {
    return null;
  }

  const translated = translateRequest('anthropic', 'responses', payload);

  if ('refusal' in translated) {
    return null;
  }

  return 'outcome' in translated
    ? { ...raw, model: providerModel }
    : { ...translated.value, model: providerModel };
}

function localCount(raw: JsonObject, grant: ResolvedGrant, providerModel: string): Response {
  if (grant.spend.custody === 'subscription' && grant.spend.provider === 'openai') {
    const body = codexCountBody(raw, providerModel);

    return body === null
      ? refusalResponse('anthropic', emptyConversation())
      : jsonResponse({ input_tokens: countCodexInputTokens(body, providerModel) }, 200);
  }

  return jsonResponse({ input_tokens: countClaudeInputTokens(raw) }, 200);
}

async function resolvedCount(
  c: Context,
  raw: JsonObject,
  grant: ResolvedGrant,
  providerModel: string,
  subscriptions: SubscriptionRuntime,
  fetchLike: typeof fetch,
): Promise<Response> {
  const native = await nativeProviderCount(raw, grant, providerModel, subscriptions, fetchLike);

  if (native !== null) {
    return native;
  }

  if (grant.spend.custody !== 'subscription' || grant.spend.provider !== 'anthropic') {
    return localCount(raw, grant, providerModel);
  }

  return reachSubscriptionCount(
    grant,
    { ...raw, model: providerModel },
    subscriptions,
    requestSessionId(c, raw),
  );
}

async function nativeProviderCount(
  raw: JsonObject,
  grant: ResolvedGrant,
  providerModel: string,
  subscriptions: SubscriptionRuntime,
  fetchLike: typeof fetch,
): Promise<Response | null> {
  if (grant.spend.custody === 'credentialed' && grant.spend.provider === 'gemini') {
    return geminiCount(raw, grant.providerOrigin, grant.spend.credential, providerModel, fetchLike);
  }

  if (grant.spend.custody === 'subscription' && grant.spend.provider === 'antigravity') {
    return antigravityCount(raw, grant, providerModel, subscriptions);
  }

  return null;
}

async function antigravityCount(
  raw: JsonObject,
  grant: ResolvedGrant,
  providerModel: string,
  subscriptions: SubscriptionRuntime,
): Promise<Response> {
  const translated = geminiCountPayload(raw);

  if (translated === null) {
    return refusalResponse('anthropic', emptyConversation());
  }

  const answer = await reachAntigravityCount(
    grant,
    { ...translated, model: providerModel },
    subscriptions,
  );

  return geminiCountAnswer(answer, await answer.json());
}

async function geminiCount(
  raw: JsonObject,
  providerOrigin: string,
  credential: string,
  providerModel: string,
  fetchLike: typeof fetch,
): Promise<Response> {
  const translated = geminiCountPayload(raw);

  if (translated === null) {
    return refusalResponse('anthropic', emptyConversation());
  }

  const origin = providerOrigin.replace(/\/+$/u, '');
  const answer = await fetchLike(
    `${origin}/v1beta/models/${encodeURIComponent(providerModel)}:countTokens`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': credential },
      body: JSON.stringify(translated),
    },
  );

  return geminiCountAnswer(answer, await answer.json());
}

function geminiCountPayload(raw: JsonObject): JsonObject | null {
  const payload = ingressPayload('anthropic', raw);

  if (payload === null) {
    return null;
  }

  const translated = translateRequestToGemini('anthropic', payload);

  return 'refusal' in translated ? null : translated.value;
}

function geminiCountAnswer(answer: Response, body: unknown): Response {
  const total = isJsonObject(body) ? body['totalTokens'] : undefined;

  return typeof total === 'number'
    ? jsonResponse({ input_tokens: total }, answer.status)
    : new Response(JSON.stringify(body), { status: answer.status });
}

type VirtualLookup = { virtual: EngineVirtualModel } | { refusal: Response };

function countVirtual(gateway: EngineGateway, model: string): VirtualLookup {
  const virtual = gateway.virtualModels.find((candidate) => candidate.id === model);

  if (virtual === undefined) {
    return { refusal: refusalResponse('anthropic', unknownModel(model)) };
  }

  return virtual.target.standing === 'removed'
    ? { refusal: refusalResponse('anthropic', missingTarget(gateway.displayName, model)) }
    : { virtual };
}

async function countWithGrant(
  c: Context,
  gateway: EngineGateway,
  raw: JsonObject,
  model: string,
  virtual: EngineVirtualModel,
  spendGrantFor: SpendGrantFor,
  subscriptions: SubscriptionRuntime,
  fetchLike: typeof fetch,
): Promise<Response> {
  const grant = await spendGrantFor(gateway.slug, model);
  const denied = deniedCount(gateway, model, grant);

  if (grant.verdict !== 'resolved') {
    return denied ?? refusalResponse('anthropic', missingTarget(gateway.displayName, model));
  }

  if (denied !== undefined) {
    return denied;
  }

  const providerModel = virtual.target.standing === 'bound' ? virtual.target.providerModel : model;

  return safeResolvedCount(c, gateway, raw, model, grant, providerModel, subscriptions, fetchLike);
}

async function safeResolvedCount(
  c: Context,
  gateway: EngineGateway,
  raw: JsonObject,
  model: string,
  grant: ResolvedGrant,
  providerModel: string,
  subscriptions: SubscriptionRuntime,
  fetchLike: typeof fetch,
): Promise<Response> {
  try {
    return await resolvedCount(c, raw, grant, providerModel, subscriptions, fetchLike);
  } catch (failure) {
    console.error(`recompose could not count tokens for virtual model "${model}"`, failure);

    return refusalResponse('anthropic', missingTarget(gateway.displayName, model));
  }
}

export async function proxyTokenCountRequest(
  c: Context,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  subscriptions: SubscriptionRuntime,
  fetchLike: typeof fetch = globalThis.fetch,
): Promise<Response> {
  const raw = await readJsonBody(c);
  const model = typeof raw['model'] === 'string' ? raw['model'] : '';
  const lookup = countVirtual(gateway, model);

  if ('refusal' in lookup) {
    return lookup.refusal;
  }

  return countWithGrant(
    c,
    gateway,
    raw,
    model,
    lookup.virtual,
    spendGrantFor,
    subscriptions,
    fetchLike,
  );
}
