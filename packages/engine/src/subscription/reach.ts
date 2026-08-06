import type { SpendGrant, SubscriptionProviderId } from '@recompose/contracts';

import { randomUUID } from 'node:crypto';

import type { JsonObject, ProxyDialect } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';
import type { ClaudeProfile } from './provider-transport';
import type { RefreshFetch } from './refresh';

import { antigravityPairingPreflight } from './antigravity-pairing';
import { AntigravityReasoningReplay, replayedAntigravityBody } from './antigravity-replay';
import { antigravityProviderRequest } from './antigravity-request';
import { ClaudeDiagnostics, injectClaudeDiagnostics } from './claude-diagnostics';
import { newClaudeDeviceId } from './claude-identity';
import { claudeProviderRequest } from './claude-request';
import { CodexReasoningReplay } from './codex-replay';
import { codexProviderRequest } from './codex-request';
import { parseSubscriptionCredential, withClaudeCredentialIdentity } from './credentials';
import {
  fetchClaudeProfile,
  sendSubscriptionRequest,
  subscriptionRefreshFetch,
} from './provider-transport';
import {
  readySubscriptionCredential,
  refreshedAndPersisted,
  shouldRefreshUnauthorized,
} from './reach-credential';
import { observeSubscriptionAnswer } from './reach-observation';

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
  codexReplay?: CodexReasoningReplay;
  antigravityReplay?: AntigravityReasoningReplay;
  antigravitySensitiveWords?: readonly string[];
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
    codexReplay: new CodexReasoningReplay(),
    antigravityReplay: new AntigravityReasoningReplay(),
  };
}

export type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type SubscriptionSpend = Extract<ResolvedGrant['spend'], { custody: 'subscription' }>;
type SubscriptionScope = {
  sessionId: string;
  sourceDialect: ProxyDialect;
  replayScopeId: string;
};

function providerRequestFor(
  grant: ResolvedGrant,
  body: JsonObject,
  credential: ParsedSubscriptionCredential,
  runtime: SubscriptionRuntime,
  scope: SubscriptionScope,
): ProviderRequest {
  const spend = grant.spend;

  if (spend.custody !== 'subscription') {
    throw new Error('a non-subscription spend reached the subscription request builder');
  }

  if (spend.provider === 'anthropic') {
    return claudeProviderRequest(
      grant.providerOrigin,
      injectClaudeDiagnostics(
        body,
        runtime.diagnostics.previous(diagnosticsKey(grant, scope.sessionId)),
      ),
      credential.accessToken,
      { sessionId: scope.sessionId, requestId: runtime.randomUUID() },
      claudeIdentityOf(credential),
      runtime.now(),
    );
  }

  if (spend.provider === 'antigravity') {
    const replayed = replayedAntigravityBody(
      runtime.antigravityReplay,
      spend.accountId,
      body,
      scope.replayScopeId,
    );

    return antigravityProviderRequest(
      grant.providerOrigin,
      replayed,
      credential,
      { sessionId: scope.sessionId, requestId: runtime.randomUUID() },
      runtime.now(),
      runtime.antigravitySensitiveWords,
    );
  }

  const replayed = replayedCodexBody(body, runtime, scope.replayScopeId, scope.sourceDialect);

  return codexProviderRequest(grant.providerOrigin, replayed, credential, runtime.randomUUID());
}

function replayedCodexBody(
  body: JsonObject,
  runtime: SubscriptionRuntime,
  sessionId: string,
  sourceDialect: ProxyDialect,
): JsonObject {
  if (sourceDialect !== 'anthropic' || runtime.codexReplay === undefined) {
    return body;
  }

  return runtime.codexReplay.inject(codexReplayKey(body, sessionId), body);
}

function claudeIdentityOf(credential: ParsedSubscriptionCredential) {
  const deviceId = credential.deviceIds?.[0];

  return credential.accountUuid === undefined || deviceId === undefined
    ? undefined
    : { accountUuid: credential.accountUuid, deviceId };
}

function diagnosticsKey(grant: ResolvedGrant, sessionId: string): string {
  return grant.spend.custody === 'subscription'
    ? `${grant.spend.accountId}\0${sessionId}`
    : sessionId;
}

export async function reachSubscription(
  grant: ResolvedGrant,
  body: JsonObject,
  runtime: SubscriptionRuntime,
  sessionId = runtime.randomUUID(),
  sourceDialect: ProxyDialect = 'responses',
  replayScopeId?: string,
): Promise<Response> {
  const scope = subscriptionScope(sessionId, sourceDialect, replayScopeId);
  const spend = subscriptionSpendOf(grant);
  const preflight = antigravityPairingPreflight(
    spend,
    body,
    runtime.antigravityReplay,
    scope.replayScopeId,
  );

  if (preflight !== null) return preflight;

  const ready = await readySubscriptionCredential(spend, runtime);
  const identified = await readyClaudeIdentity(spend, ready, runtime);
  const answer = await runtime.send(
    spend.provider,
    providerRequestFor(grant, body, identified.credential, runtime, scope),
  );

  const finalAnswer = shouldRefreshUnauthorized(answer, identified.credential)
    ? await retryWithRefreshedCredential(grant, spend, body, identified.blob, runtime, scope)
    : answer;

  return observeSubscriptionAnswer(grant, body, finalAnswer, runtime, scope);
}

function subscriptionScope(
  sessionId: string,
  sourceDialect: ProxyDialect,
  replayScopeId: string | undefined,
): SubscriptionScope {
  return { sessionId, sourceDialect, replayScopeId: replayScopeId ?? sessionId };
}

function subscriptionSpendOf(grant: ResolvedGrant): SubscriptionSpend {
  if (grant.spend.custody !== 'subscription') {
    throw new Error('a non-subscription spend reached the subscription transport');
  }

  return grant.spend;
}

function codexReplayKey(body: JsonObject, sessionId: string): string {
  const model = typeof body['model'] === 'string' ? body['model'] : '';

  return `${model}\0${sessionId}`;
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

async function retryWithRefreshedCredential(
  grant: ResolvedGrant,
  spend: SubscriptionSpend,
  body: JsonObject,
  blob: string,
  runtime: SubscriptionRuntime,
  scope: SubscriptionScope,
): Promise<Response> {
  const retried = await refreshedAndPersisted(spend, blob, runtime);

  return runtime.send(
    spend.provider,
    providerRequestFor(grant, body, retried.credential, runtime, scope),
  );
}
