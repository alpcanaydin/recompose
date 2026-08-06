import type { SpendGrant, SubscriptionProviderId } from '@recompose/contracts';

import { randomUUID } from 'node:crypto';

import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';
import type { ClaudeProfile } from './provider-transport';
import type { RefreshFetch } from './refresh';

import {
  ClaudeDiagnostics,
  injectClaudeDiagnostics,
  observeClaudeDiagnostics,
} from './claude-diagnostics';
import { newClaudeDeviceId } from './claude-identity';
import { claudeProviderRequest } from './claude-request';
import { codexProviderRequest } from './codex-request';
import { parseSubscriptionCredential, withClaudeCredentialIdentity } from './credentials';
import {
  fetchClaudeProfile,
  sendSubscriptionRequest,
  subscriptionRefreshFetch,
} from './provider-transport';
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
  newClaudeDeviceId: () => string;
  fetchClaudeProfile: (accessToken: string) => Promise<ClaudeProfile>;
  diagnostics: ClaudeDiagnostics;
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
    newClaudeDeviceId,
    fetchClaudeProfile,
    diagnostics: new ClaudeDiagnostics(),
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
  sessionId: string,
): ProviderRequest {
  return grant.spend.custody === 'subscription' && grant.spend.provider === 'anthropic'
    ? claudeProviderRequest(
        grant.providerOrigin,
        injectClaudeDiagnostics(
          body,
          runtime.diagnostics.previous(diagnosticsKey(grant, sessionId)),
        ),
        credential.accessToken,
        { sessionId, requestId: runtime.randomUUID() },
        claudeIdentityOf(credential),
      )
    : codexProviderRequest(grant.providerOrigin, body, credential, runtime.randomUUID());
}

function claudeIdentityOf(credential: ParsedSubscriptionCredential) {
  const deviceId = credential.deviceIds?.[0];

  return credential.accountUuid === undefined || deviceId === undefined
    ? undefined
    : { accountUuid: credential.accountUuid, deviceId };
}

export async function reachSubscription(
  grant: ResolvedGrant,
  body: JsonObject,
  runtime: SubscriptionRuntime,
  sessionId = runtime.randomUUID(),
): Promise<Response> {
  if (grant.spend.custody !== 'subscription') {
    throw new Error('a non-subscription spend reached the subscription transport');
  }

  const ready = await readySubscriptionCredential(grant.spend, runtime);
  const identified = await readyClaudeIdentity(grant.spend, ready, runtime);
  const answer = await runtime.send(
    grant.spend.provider,
    providerRequestFor(grant, body, identified.credential, runtime, sessionId),
  );

  const finalAnswer = shouldRefreshUnauthorized(answer, identified.credential)
    ? await retryWithRefreshedCredential(
        grant,
        grant.spend,
        body,
        identified.blob,
        runtime,
        sessionId,
      )
    : answer;

  return observeClaudeAnswer(grant, finalAnswer, runtime, sessionId);
}

function diagnosticsKey(grant: ResolvedGrant, sessionId: string): string {
  return grant.spend.custody === 'subscription'
    ? `${grant.spend.accountId}\0${sessionId}`
    : sessionId;
}

async function observeClaudeAnswer(
  grant: ResolvedGrant,
  answer: Response,
  runtime: SubscriptionRuntime,
  sessionId: string,
): Promise<Response> {
  if (grant.spend.custody !== 'subscription' || grant.spend.provider !== 'anthropic') {
    return answer;
  }

  const key = diagnosticsKey(grant, sessionId);

  return observeClaudeDiagnostics(answer, (messageId) => {
    runtime.diagnostics.commit(key, messageId);
  });
}

type ReadyCredential = { blob: string; credential: ParsedSubscriptionCredential };

async function readyClaudeIdentity(
  spend: SubscriptionSpend,
  ready: ReadyCredential,
  runtime: SubscriptionRuntime,
): Promise<ReadyCredential> {
  if (spend.provider !== 'anthropic') {
    return ready;
  }

  if (claudeIdentityOf(ready.credential) !== undefined) {
    return ready;
  }

  const identity = await resolvedClaudeIdentity(ready.credential, runtime);

  const blob = withClaudeCredentialIdentity(ready.blob, identity.accountUuid, identity.deviceId);

  await runtime.persist(spend.provider, spend.accountId, blob);

  const credential = parseSubscriptionCredential(spend.provider, blob);

  if (credential === null) {
    throw new Error('the identified subscription credential could not be read');
  }

  return { blob, credential };
}

async function resolvedClaudeIdentity(
  credential: ParsedSubscriptionCredential,
  runtime: SubscriptionRuntime,
) {
  return {
    accountUuid: await accountUuidFor(credential, runtime),
    deviceId: deviceIdFor(credential, runtime),
  };
}

async function accountUuidFor(
  credential: ParsedSubscriptionCredential,
  runtime: SubscriptionRuntime,
): Promise<string> {
  if (credential.accountUuid !== undefined) {
    return credential.accountUuid;
  }

  return (await runtime.fetchClaudeProfile(credential.accessToken)).account.uuid;
}

function deviceIdFor(
  credential: ParsedSubscriptionCredential,
  runtime: SubscriptionRuntime,
): string {
  return credential.deviceIds?.[0] ?? runtime.newClaudeDeviceId();
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
  sessionId: string,
): Promise<Response> {
  const retried = await refreshedAndPersisted(spend, blob, runtime);

  return runtime.send(
    spend.provider,
    providerRequestFor(grant, body, retried.credential, runtime, sessionId),
  );
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
