import type { SpendGrant, SubscriptionProviderId } from '@recompose/contracts';

import { randomUUID } from 'node:crypto';

import type { JsonObject, ProxyDialect } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';
import type { SubscriptionAttempt, SubscriptionPluginContext } from './intercepted-send';
import type { ClaudeProfile } from './provider-transport';
import type { RefreshFetch } from './refresh';

import { normalizeAntigravityError } from './antigravity-errors';
import { antigravityPairingPreflight } from './antigravity-pairing';
import { AntigravityReasoningReplay, replayedAntigravityBody } from './antigravity-replay';
import { antigravityProviderRequest } from './antigravity-request';
import { completeSubscriptionAttempt } from './attempt-completion';
import { ClaudeDiagnostics, injectClaudeDiagnostics } from './claude-diagnostics';
import { newClaudeDeviceId } from './claude-identity';
import { claudeProviderRequest } from './claude-request';
import { normalizeCodexError } from './codex-errors';
import { CodexReasoningReplay } from './codex-replay';
import { codexProviderRequest } from './codex-request';
import { sendInterceptedSubscription } from './intercepted-send';
import {
  fetchClaudeProfile,
  sendSubscriptionRequest,
  subscriptionRefreshFetch,
} from './provider-transport';
import { readySubscriptionCredential, refreshedAndPersisted } from './reach-credential';
import { observeSubscriptionAnswer, subscriptionDiagnosticsKey } from './reach-observation';
import { readyClaudeIdentity } from './ready-claude-identity';

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
  wait?: ((milliseconds: number) => Promise<void>) | undefined;
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
  responsesLite: boolean;
};
type ReadyCredential = { blob: string; credential: ParsedSubscriptionCredential };

async function normalizedSubscriptionAnswer(
  provider: SubscriptionProviderId,
  answer: Response,
  now: number,
): Promise<Response> {
  if (provider === 'openai') return normalizeCodexError(answer, now);
  if (provider === 'antigravity') return normalizeAntigravityError(answer);

  return answer;
}

function attemptCallbacks(
  grant: ResolvedGrant,
  spend: SubscriptionSpend,
  body: JsonObject,
  ready: ReadyCredential,
  runtime: SubscriptionRuntime,
  scope: SubscriptionScope,
  pluginContext?: SubscriptionPluginContext,
) {
  return {
    resend: async () =>
      sendInterceptedSubscription(
        spend.provider,
        spend.accountId,
        body,
        providerRequestFor(grant, body, ready.credential, runtime, scope),
        runtime.send,
        pluginContext,
      ),
    refresh: async () =>
      retryWithRefreshedCredential(grant, spend, body, ready.blob, runtime, scope, pluginContext),
  };
}

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
        runtime.diagnostics.previous(subscriptionDiagnosticsKey(grant, scope.sessionId)),
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

  return codexProviderRequest(
    grant.providerOrigin,
    replayed,
    credential,
    runtime.randomUUID(),
    scope.responsesLite,
  );
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

export async function reachSubscription(
  grant: ResolvedGrant,
  body: JsonObject,
  runtime: SubscriptionRuntime,
  sessionId = runtime.randomUUID(),
  sourceDialect: ProxyDialect = 'responses',
  replayScopeId?: string,
  responsesLite?: boolean,
  pluginContext?: SubscriptionPluginContext,
): Promise<Response> {
  const scope = subscriptionScope(sessionId, sourceDialect, replayScopeId, responsesLite);
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
  const attempt = await sendInterceptedSubscription(
    spend.provider,
    spend.accountId,
    body,
    providerRequestFor(grant, body, identified.credential, runtime, scope),
    runtime.send,
    pluginContext,
  );

  const finalAttempt = await completeSubscriptionAttempt({
    attempt,
    provider: spend.provider,
    credential: identified.credential,
    wait: runtime.wait,
    ...attemptCallbacks(grant, spend, body, identified, runtime, scope, pluginContext),
  });

  if (finalAttempt.terminated) return finalAttempt.answer;

  const normalized = await normalizedSubscriptionAnswer(
    spend.provider,
    finalAttempt.answer,
    runtime.now(),
  );

  return observeSubscriptionAnswer(grant, body, normalized, runtime, scope);
}

function subscriptionScope(
  sessionId: string,
  sourceDialect: ProxyDialect,
  replayScopeId: string | undefined,
  responsesLite: boolean | undefined,
): SubscriptionScope {
  return {
    sessionId,
    sourceDialect,
    replayScopeId: replayScopeId ?? sessionId,
    responsesLite: responsesLite === true,
  };
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

async function retryWithRefreshedCredential(
  grant: ResolvedGrant,
  spend: SubscriptionSpend,
  body: JsonObject,
  blob: string,
  runtime: SubscriptionRuntime,
  scope: SubscriptionScope,
  pluginContext?: SubscriptionPluginContext,
): Promise<SubscriptionAttempt> {
  const retried = await refreshedAndPersisted(spend, blob, runtime);

  return sendInterceptedSubscription(
    spend.provider,
    spend.accountId,
    body,
    providerRequestFor(grant, body, retried.credential, runtime, scope),
    runtime.send,
    pluginContext,
  );
}
