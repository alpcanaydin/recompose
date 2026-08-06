import type { SpendGrant, SubscriptionProviderId } from '@recompose/contracts';

import { randomUUID } from 'node:crypto';

import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';
import type { RefreshFetch } from './refresh';

import { claudeProviderRequest } from './claude-request';
import { codexProviderRequest } from './codex-request';
import { parseSubscriptionCredential } from './credentials';
import { sendSubscriptionRequest, subscriptionRefreshFetch } from './provider-transport';
import { credentialNeedsRefresh, refreshSubscriptionCredential } from './refresh';

export type SubscriptionRuntime = {
  send: (provider: SubscriptionProviderId, request: ProviderRequest) => Promise<Response>;
  refreshFetch: RefreshFetch;
  persist: (
    provider: SubscriptionProviderId,
    accountId: string,
    credential: string,
  ) => Promise<void>;
  now: () => number;
  randomUUID: () => string;
};

export function subscriptionRuntime(
  persist: SubscriptionRuntime['persist'] = async () => {
    await Promise.reject(new Error('subscription credential persistence is unavailable'));
  },
): SubscriptionRuntime {
  return {
    send: sendSubscriptionRequest,
    refreshFetch: subscriptionRefreshFetch,
    persist,
    now: Date.now,
    randomUUID,
  };
}

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type SubscriptionSpend = Extract<ResolvedGrant['spend'], { custody: 'subscription' }>;

async function refreshedAndPersisted(
  spend: SubscriptionSpend,
  blob: string,
  runtime: SubscriptionRuntime,
): Promise<{ blob: string; credential: ParsedSubscriptionCredential }> {
  const refreshed = await refreshSubscriptionCredential(
    spend.provider,
    blob,
    runtime.refreshFetch,
    runtime.now(),
  );

  await runtime.persist(spend.provider, spend.accountId, refreshed);

  const credential = parseSubscriptionCredential(spend.provider, refreshed);

  if (credential === null) {
    throw new Error('the refreshed subscription credential could not be read');
  }

  return { blob: refreshed, credential };
}

function providerRequestFor(
  grant: ResolvedGrant,
  body: JsonObject,
  credential: ParsedSubscriptionCredential,
  runtime: SubscriptionRuntime,
): ProviderRequest {
  return grant.spend.custody === 'subscription' && grant.spend.provider === 'anthropic'
    ? claudeProviderRequest(grant.providerOrigin, body, credential.accessToken, {
        sessionId: runtime.randomUUID(),
        requestId: runtime.randomUUID(),
      })
    : codexProviderRequest(grant.providerOrigin, body, credential, runtime.randomUUID());
}

export async function reachSubscription(
  grant: ResolvedGrant,
  body: JsonObject,
  runtime: SubscriptionRuntime,
): Promise<Response> {
  if (grant.spend.custody !== 'subscription') {
    throw new Error('a non-subscription spend reached the subscription transport');
  }

  const ready = await readySubscriptionCredential(grant.spend, runtime);
  const answer = await runtime.send(
    grant.spend.provider,
    providerRequestFor(grant, body, ready.credential, runtime),
  );

  return shouldRefreshUnauthorized(answer, ready.credential)
    ? retryWithRefreshedCredential(grant, grant.spend, body, ready.blob, runtime)
    : answer;
}

function shouldRefreshUnauthorized(
  answer: Response,
  credential: ParsedSubscriptionCredential,
): boolean {
  return answer.status === 401 && credential.refreshToken !== undefined;
}

async function retryWithRefreshedCredential(
  grant: ResolvedGrant,
  spend: SubscriptionSpend,
  body: JsonObject,
  blob: string,
  runtime: SubscriptionRuntime,
): Promise<Response> {
  const retried = await refreshedAndPersisted(spend, blob, runtime);

  return runtime.send(spend.provider, providerRequestFor(grant, body, retried.credential, runtime));
}

async function readySubscriptionCredential(
  spend: SubscriptionSpend,
  runtime: SubscriptionRuntime,
): Promise<{ blob: string; credential: ParsedSubscriptionCredential }> {
  const credential = parseSubscriptionCredential(spend.provider, spend.credential);

  if (credential === null) {
    throw new Error('the subscription credential could not be read');
  }

  return credentialNeedsRefresh(credential, runtime.now())
    ? refreshedAndPersisted(spend, spend.credential, runtime)
    : { blob: spend.credential, credential };
}
