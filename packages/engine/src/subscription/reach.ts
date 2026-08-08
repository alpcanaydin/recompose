import type {
  AccountTransportPolicy,
  SpendGrant,
  SubscriptionProviderId,
} from '@recompose/contracts';

import type { JsonObject, ProxyDialect } from '../gateway-wire';
import type { AntigravityReasoningReplay } from './antigravity-replay';
import type { ClaudeDeviceProfile } from './claude-device-profile';
import type { ClaudePayloadPolicy } from './claude-payload-policy';
import type { ProviderRequest } from './claude-request';
import type { ClaudeSystemPolicy } from './claude-system-policy';
import type { CodexReasoningReplay } from './codex-replay';
import type { CredentialRuntimePolicy } from './credential-runtime-policy';
import type { ParsedSubscriptionCredential } from './credentials';
import type { SubscriptionAttempt, SubscriptionPluginContext } from './intercepted-send';
import type { ClaudeProfile } from './provider-transport';
import type { RefreshFetch } from './refresh';

import { normalizeAntigravityError } from './antigravity-errors';
import { antigravityPairingPreflight } from './antigravity-pairing';
import { antigravityReachRequest } from './antigravity-reach-request';
import { completeSubscriptionAttempt } from './attempt-completion';
import { ClaudeDiagnostics, injectClaudeDiagnostics } from './claude-diagnostics';
import { claudeReachRequest } from './claude-reach-request';
import { hydrateCodexCompletionStream } from './codex-completion';
import { normalizeCodexError } from './codex-errors';
import { codexReachRequest } from './codex-reach-request';
import { sendInterceptedSubscription } from './intercepted-send';
import { readySubscriptionCredential, refreshedAndPersisted } from './reach-credential';
import { observeSubscriptionAnswer, subscriptionDiagnosticsKey } from './reach-observation';
import { readyClaudeIdentity } from './ready-claude-identity';

export { subscriptionRuntime } from './subscription-runtime';

export type SubscriptionRuntime = {
  send: (
    provider: SubscriptionProviderId,
    request: ProviderRequest,
    policy?: AccountTransportPolicy,
  ) => Promise<Response>;
  refreshFetch: RefreshFetch;
  persist: (
    provider: SubscriptionProviderId,
    accountId: string,
    credential: string,
  ) => Promise<void>;
  now: () => number;
  randomUUID: () => string;
  newClaudeDeviceId: () => string;
  fetchClaudeProfile: (
    accessToken: string,
    policy?: AccountTransportPolicy,
  ) => Promise<ClaudeProfile>;
  diagnostics: ClaudeDiagnostics;
  claudeTimezone?: string;
  claudeSystemPolicy?: ClaudeSystemPolicy;
  claudePayloadPolicy?: ClaudePayloadPolicy;
  claudeDeviceProfile?: ClaudeDeviceProfile;
  credentialPolicy?: CredentialRuntimePolicy;
  codexReplay?: CodexReasoningReplay;
  antigravityReplay?: AntigravityReasoningReplay;
  antigravitySensitiveWords?: readonly string[];
  wait?: ((milliseconds: number) => Promise<void>) | undefined;
};

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
  if (provider === 'openai') {
    return hydrateCodexCompletionStream(await normalizeCodexError(answer, now));
  }

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
        async (provider, request) => runtime.send(provider, request, spend.transportPolicy),
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
  const spend = subscriptionSpend(grant);

  if (spend.provider === 'anthropic') {
    return claudeReachRequest({
      providerOrigin: grant.providerOrigin,
      body: diagnosedClaudeBody(grant, scope, body, runtime),
      credential,
      sessionId: scope.sessionId,
      requestId: runtime.randomUUID(),
      now: runtime.now(),
      configuredTimezone: runtime.claudeTimezone,
      systemPolicy: runtime.claudeSystemPolicy,
      payloadPolicy: runtime.claudePayloadPolicy,
      wireProfile: runtime.claudeDeviceProfile,
    });
  }

  if (spend.provider === 'antigravity') {
    return antigravityReachRequest({
      providerOrigin: grant.providerOrigin,
      body,
      credential,
      accountId: spend.accountId,
      replayScopeId: scope.replayScopeId,
      sessionId: scope.sessionId,
      replay: runtime.antigravityReplay,
      requestId: runtime.randomUUID(),
      now: runtime.now(),
      sensitiveWords: runtime.antigravitySensitiveWords,
    });
  }

  return codexReachRequest({
    providerOrigin: grant.providerOrigin,
    body,
    credential,
    replay: runtime.codexReplay,
    replayScopeId: scope.replayScopeId,
    sessionId: scope.sessionId,
    sourceDialect: scope.sourceDialect,
    responsesLite: scope.responsesLite,
    requestId: runtime.randomUUID(),
  });
}

function diagnosedClaudeBody(
  grant: ResolvedGrant,
  scope: SubscriptionScope,
  body: JsonObject,
  runtime: SubscriptionRuntime,
): JsonObject {
  return injectClaudeDiagnostics(
    body,
    runtime.diagnostics.previous(subscriptionDiagnosticsKey(grant, scope.sessionId)),
  );
}

function subscriptionSpend(grant: ResolvedGrant): SubscriptionSpend {
  if (grant.spend.custody === 'subscription') return grant.spend;

  throw new Error('a non-subscription spend reached the subscription request builder');
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
    async (provider, request) => runtime.send(provider, request, spend.transportPolicy),
    pluginContext,
  );

  const finalAttempt = await completeSubscriptionAttempt({
    attempt,
    provider: spend.provider,
    credential: identified.credential,
    requestBody: body,
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
    async (provider, request) => runtime.send(provider, request, spend.transportPolicy),
    pluginContext,
  );
}
