import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import type { SpendGrantFor, SubscriptionRuntime } from './gateway-proxy';
import type { JsonObject } from './gateway-wire';

import { requestSessions } from './gateway-session';
import { jsonResponse, readJsonBody, refusalResponse, virtualNameOf } from './gateway-wire';
import { missingCredential, missingTarget, unknownModel } from './refusals';
import { normalizeCodexError } from './subscription/codex-errors';
import { restoreCodexMultiAgentValue } from './subscription/codex-multi-agent';
import { reachCodexCompact } from './subscription/reach-compact';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type RefusedGrant = Exclude<SpendGrant, { verdict: 'resolved' }>;
type CompactTarget = { response: Response } | { providerModel: string; virtualId: string };

function denied(gateway: EngineGateway, model: string, grant: RefusedGrant): Response {
  return grant.verdict === 'missing-target'
    ? refusalResponse('responses', missingTarget(gateway.displayName, model))
    : refusalResponse('responses', missingCredential(gateway.displayName, model));
}

function isCodexGrant(grant: ResolvedGrant): boolean {
  return grant.spend.custody === 'subscription' && grant.spend.provider === 'openai';
}

async function genericCompact(
  grant: ResolvedGrant,
  body: JsonObject,
  providerModel: string,
  fetchLike: typeof fetch,
): Promise<Response | null> {
  if (grant.spend.custody !== 'credentialed') return null;

  const origin = grant.providerOrigin.replace(/\/+$/u, '');

  return fetchLike(`${origin}/responses/compact`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${grant.spend.credential}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, model: providerModel }),
  });
}

async function nonCodexCompact(
  grant: ResolvedGrant,
  body: JsonObject,
  providerModel: string,
  fetchLike: typeof fetch,
  fallback: Response,
): Promise<Response> {
  return (await genericCompact(grant, body, providerModel, fetchLike)) ?? fallback;
}

async function restoredCompactAnswer(answer: Response, now: number): Promise<Response> {
  const normalized = answer.ok ? answer : await normalizeCodexError(answer, now);
  const value: unknown = await normalized
    .clone()
    .json()
    .catch(() => null);

  return value === null
    ? normalized
    : jsonResponse(restoreCodexMultiAgentValue(value), normalized.status);
}

function compactTarget(gateway: EngineGateway, model: string): CompactTarget {
  const virtual = gateway.virtualModels.find((candidate) => candidate.id === model);

  if (virtual === undefined) {
    return { response: refusalResponse('responses', unknownModel(model)) };
  }

  if (virtual.target.standing === 'removed') {
    return { response: refusalResponse('responses', missingTarget(gateway.displayName, model)) };
  }

  return { providerModel: virtual.target.providerModel, virtualId: virtual.id };
}

async function resolvedCompact(
  c: Context,
  gateway: EngineGateway,
  model: string,
  body: JsonObject,
  grant: SpendGrant,
  runtime: SubscriptionRuntime,
  providerModel: string,
  fetchLike: typeof fetch,
): Promise<Response> {
  if (grant.verdict !== 'resolved') return denied(gateway, model, grant);

  if (!isCodexGrant(grant)) {
    return nonCodexCompact(
      grant,
      body,
      providerModel,
      fetchLike,
      refusalResponse('responses', missingCredential(gateway.displayName, model)),
    );
  }

  const providerBody: JsonObject = { ...body, model: providerModel };
  const sessions = requestSessions(c, body);
  const answer = await reachCodexCompact(grant, providerBody, runtime, sessions.sessionId);

  return restoredCompactAnswer(answer, runtime.now());
}

export async function proxyCodexCompactRequest(
  c: Context,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  runtime: SubscriptionRuntime,
  fetchLike: typeof fetch,
): Promise<Response> {
  const body = await readJsonBody(c);
  const model = virtualNameOf(body, 'responses');
  const target = compactTarget(gateway, model);

  if ('response' in target) return target.response;

  const grant = await spendGrantFor(gateway.slug, target.virtualId);

  return resolvedCompact(c, gateway, model, body, grant, runtime, target.providerModel, fetchLike);
}
