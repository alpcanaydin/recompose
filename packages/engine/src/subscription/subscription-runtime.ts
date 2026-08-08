import type { AccountTransportPolicy, SubscriptionProviderId } from '@recompose/contracts';

import { randomUUID } from 'node:crypto';

import type { ProviderRequest } from './claude-request';
import type { ClaudeProfile } from './provider-transport';

import { AntigravityReasoningReplay } from './antigravity-replay';
import { ClaudeDiagnostics } from './claude-diagnostics';
import { newClaudeDeviceId } from './claude-identity';
import { CodexReasoningReplay } from './codex-replay';
import {
  fetchClaudeProfile,
  sendSubscriptionRequest,
  subscriptionRefreshFetch,
} from './provider-transport';

type PersistCredential = (
  provider: 'anthropic' | 'openai' | 'antigravity',
  accountId: string,
  credential: string,
) => Promise<void>;

export function subscriptionRuntime(
  persist: PersistCredential = async () => {
    await Promise.reject(new Error('subscription credential persistence is unavailable'));
  },
) {
  return {
    send: async (
      provider: SubscriptionProviderId,
      request: ProviderRequest,
      policy?: AccountTransportPolicy,
    ) => sendSubscriptionRequest(provider, request, undefined, policy),
    refreshFetch: subscriptionRefreshFetch,
    persist,
    now: Date.now,
    randomUUID,
    newClaudeDeviceId,
    fetchClaudeProfile: async (
      accessToken: string,
      policy?: AccountTransportPolicy,
    ): Promise<ClaudeProfile> => fetchClaudeProfile(accessToken, undefined, policy),
    diagnostics: new ClaudeDiagnostics(),
    codexReplay: new CodexReasoningReplay(),
    antigravityReplay: new AntigravityReasoningReplay(),
  };
}
