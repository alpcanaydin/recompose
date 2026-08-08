import type { SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import type { SubscriptionRuntime } from '../gateway-proxy';
import type { Crossing, JsonObject } from '../gateway-wire';
import type { AIStudioRelay } from './ai-studio-relay';

import { translateRequestToGemini } from '../dialect/gemini-bridge';
import { requestSessions } from '../gateway-session';
import { ingressPayload, isJsonObject, jsonResponse, refusalResponse } from '../gateway-wire';
import { emptyConversation } from '../refusals';
import { decodeClaudeResponse } from '../subscription/claude-compression';
import { reachAntigravityCount } from '../subscription/reach-count';
import { credentialedRequestHeaders } from './credentialed-target';
import { kimiProviderBody } from './kimi-request';
import {
  parseVertexCredential,
  vertexCountBody,
  vertexHeaders,
  vertexRequestUrl,
} from './vertex-request';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type CredentialedSpend = Extract<ResolvedGrant['spend'], { custody: 'credentialed' }>;

export async function nativeProviderCount(
  c: Context,
  raw: JsonObject,
  grant: ResolvedGrant,
  providerModel: string,
  subscriptions: SubscriptionRuntime,
  fetchLike: typeof fetch,
  aiStudio?: AIStudioRelay,
): Promise<Response | null> {
  if (grant.spend.custody === 'credentialed') {
    return credentialedCount(c, raw, grant, grant.spend, providerModel, fetchLike, aiStudio);
  }

  return grant.spend.custody === 'subscription' && grant.spend.provider === 'antigravity'
    ? antigravityCount(c, raw, grant, providerModel, subscriptions)
    : null;
}

function credentialedCount(
  c: Context,
  raw: JsonObject,
  grant: ResolvedGrant,
  spend: CredentialedSpend,
  providerModel: string,
  fetchLike: typeof fetch,
  aiStudio?: AIStudioRelay,
): Promise<Response> | null {
  if (spend.provider === 'gemini') {
    return geminiCount(raw, grant.providerOrigin, spend.credential, providerModel, fetchLike);
  }

  if (spend.provider === 'vertex') {
    return vertexCount(raw, grant.providerOrigin, spend.credential, providerModel, fetchLike);
  }

  if (spend.provider === 'kimi') {
    return kimiCount(c, raw, grant.providerOrigin, spend, providerModel, fetchLike);
  }

  return spend.provider === 'aistudio' ? aiStudioCount(raw, grant, providerModel, aiStudio) : null;
}

async function kimiCount(
  c: Context,
  raw: JsonObject,
  providerOrigin: string,
  spend: CredentialedSpend,
  providerModel: string,
  fetchLike: typeof fetch,
): Promise<Response> {
  const crossing = countCrossing(raw, providerModel, c.req.header('anthropic-beta'));
  const origin = providerOrigin.replace(/\/+$/u, '');
  const answer = await fetchLike(`${origin}/v1/messages/count_tokens?beta=true`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...credentialedRequestHeaders(spend, crossing),
    },
    body: JSON.stringify(kimiProviderBody(raw, providerModel, 'anthropic')),
  });

  return decodedKimiCountAnswer(answer);
}

async function decodedKimiCountAnswer(answer: Response): Promise<Response> {
  const decoded = await decodeClaudeResponse(answer);

  try {
    const body = await decoded.arrayBuffer();

    return new Response(body, {
      status: decoded.status,
      statusText: decoded.statusText,
      headers: decoded.headers,
    });
  } catch {
    return jsonResponse(
      {
        type: 'error',
        error: { type: 'api_error', message: 'failed to decode error response body' },
      },
      answer.status,
    );
  }
}

async function aiStudioCount(
  raw: JsonObject,
  grant: ResolvedGrant,
  providerModel: string,
  relay?: AIStudioRelay,
): Promise<Response> {
  const translated = geminiCountPayload(raw);
  const channelId = grant.spend.custody === 'credentialed' ? grant.spend.accountId : undefined;

  if (translated === null || channelId === undefined || relay === undefined) {
    return refusalResponse('anthropic', emptyConversation());
  }

  const origin = grant.providerOrigin.replace(/\/+$/u, '');
  const answer = await relay.request(channelId, {
    method: 'POST',
    url: `${origin}/v1beta/models/${encodeURIComponent(providerModel)}:countTokens`,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(vertexCountBody(translated)),
  });

  return geminiCountAnswer(answer, await answer.json());
}

async function antigravityCount(
  c: Context,
  raw: JsonObject,
  grant: ResolvedGrant,
  providerModel: string,
  subscriptions: SubscriptionRuntime,
): Promise<Response> {
  const translated = geminiCountPayload(raw);

  if (translated === null) return refusalResponse('anthropic', emptyConversation());

  const answer = await reachAntigravityCount(
    grant,
    { ...translated, model: providerModel },
    subscriptions,
    requestSessions(c, raw).replayScopeId,
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

  if (translated === null) return refusalResponse('anthropic', emptyConversation());

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

async function vertexCount(
  raw: JsonObject,
  providerOrigin: string,
  secret: string,
  providerModel: string,
  fetchLike: typeof fetch,
): Promise<Response> {
  const translated = geminiCountPayload(raw);
  const credential = parseVertexCredential(secret);

  if (translated === null || credential === null) {
    return refusalResponse('anthropic', emptyConversation());
  }

  const crossing = countCrossing(raw, providerModel);
  const answer = await fetchLike(vertexRequestUrl(providerOrigin, credential, crossing, 'count'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...vertexHeaders(credential) },
    body: JSON.stringify(vertexCountBody(translated)),
  });

  return geminiCountAnswer(answer, await answer.json());
}

function countCrossing(raw: JsonObject, providerModel: string, anthropicBeta?: string): Crossing {
  return {
    dialect: 'anthropic',
    raw,
    gatewayName: '',
    virtualModel: '',
    providerModel,
    anthropicBeta,
  };
}

function geminiCountPayload(raw: JsonObject): JsonObject | null {
  const payload = ingressPayload('anthropic', raw);

  if (payload === null) return null;

  const translated = translateRequestToGemini('anthropic', payload);

  return 'refusal' in translated ? null : translated.value;
}

function geminiCountAnswer(answer: Response, body: unknown): Response {
  const total = isJsonObject(body) ? body['totalTokens'] : undefined;

  return typeof total === 'number'
    ? jsonResponse({ input_tokens: total }, answer.status)
    : new Response(JSON.stringify(body), { status: answer.status });
}
