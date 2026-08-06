import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';
import type { ResolvedGrant, SubscriptionRuntime } from './reach';

import { antigravityCountTokensRequest } from './antigravity-request';
import { claudeCountTokensProviderRequest } from './claude-count-tokens';
import {
  readySubscriptionCredential,
  refreshedAndPersisted,
  shouldRefreshUnauthorized,
} from './reach-credential';

function countRequestFor(
  grant: ResolvedGrant,
  body: JsonObject,
  credential: ParsedSubscriptionCredential,
  runtime: SubscriptionRuntime,
  sessionId: string,
): ProviderRequest {
  return claudeCountTokensProviderRequest(grant.providerOrigin, body, credential.accessToken, {
    sessionId,
    requestId: runtime.randomUUID(),
  });
}

export async function reachSubscriptionCount(
  grant: ResolvedGrant,
  body: JsonObject,
  runtime: SubscriptionRuntime,
  sessionId = runtime.randomUUID(),
): Promise<Response> {
  if (grant.spend.custody !== 'subscription' || grant.spend.provider !== 'anthropic') {
    throw new Error('a non-Claude subscription reached the native token-count transport');
  }

  const ready = await readySubscriptionCredential(grant.spend, runtime);
  const request = countRequestFor(grant, body, ready.credential, runtime, sessionId);
  const answer = await runtime.send('anthropic', request);

  if (!shouldRefreshUnauthorized(answer, ready.credential)) {
    return answer;
  }

  const retried = await refreshedAndPersisted(grant.spend, ready.blob, runtime);

  return runtime.send(
    'anthropic',
    countRequestFor(grant, body, retried.credential, runtime, sessionId),
  );
}

function antigravityCountRequest(
  grant: ResolvedGrant,
  body: JsonObject,
  credential: ParsedSubscriptionCredential,
): ProviderRequest {
  return antigravityCountTokensRequest(grant.providerOrigin, body, credential);
}

export async function reachAntigravityCount(
  grant: ResolvedGrant,
  body: JsonObject,
  runtime: SubscriptionRuntime,
): Promise<Response> {
  if (grant.spend.custody !== 'subscription' || grant.spend.provider !== 'antigravity') {
    throw new Error('a non-Antigravity subscription reached its token-count transport');
  }

  const ready = await readySubscriptionCredential(grant.spend, runtime);
  const answer = await runtime.send(
    'antigravity',
    antigravityCountRequest(grant, body, ready.credential),
  );

  if (!shouldRefreshUnauthorized(answer, ready.credential)) {
    return answer;
  }

  const retried = await refreshedAndPersisted(grant.spend, ready.blob, runtime);

  return runtime.send('antigravity', antigravityCountRequest(grant, body, retried.credential));
}
