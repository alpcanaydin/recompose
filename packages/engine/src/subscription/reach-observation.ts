import type { SpendGrant } from '@recompose/contracts';

import type { JsonObject, ProxyDialect } from '../gateway-wire';
import type { AntigravityReasoningReplay } from './antigravity-replay';
import type { ClaudeDiagnostics } from './claude-diagnostics';
import type { CodexReasoningReplay } from './codex-replay';

import {
  antigravityReplayKey,
  antigravityUsesReplay,
  observeAntigravityReasoning,
} from './antigravity-replay';
import { observeClaudeDiagnostics } from './claude-diagnostics';
import { observeCodexReasoning } from './codex-replay';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type ObservationRuntime = {
  diagnostics: ClaudeDiagnostics;
  codexReplay?: CodexReasoningReplay;
  antigravityReplay?: AntigravityReasoningReplay;
};
type ObservationScope = {
  sessionId: string;
  sourceDialect: ProxyDialect;
  replayScopeId: string;
};

function diagnosticsKey(grant: ResolvedGrant, sessionId: string): string {
  return grant.spend.custody === 'subscription'
    ? `${grant.spend.accountId}\0${sessionId}`
    : sessionId;
}

function codexReplayKey(body: JsonObject, sessionId: string): string {
  const model = typeof body['model'] === 'string' ? body['model'] : '';

  return `${model}\0${sessionId}`;
}

async function observeClaudeAnswer(
  grant: ResolvedGrant,
  answer: Response,
  runtime: ObservationRuntime,
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

function observesCodex(
  grant: ResolvedGrant,
  runtime: ObservationRuntime,
  sourceDialect: ProxyDialect,
): boolean {
  return (
    grant.spend.custody === 'subscription' &&
    grant.spend.provider === 'openai' &&
    sourceDialect === 'anthropic' &&
    runtime.codexReplay !== undefined
  );
}

function observesAntigravity(
  grant: ResolvedGrant,
  runtime: ObservationRuntime,
  body: JsonObject,
): boolean {
  return (
    grant.spend.custody === 'subscription' &&
    grant.spend.provider === 'antigravity' &&
    runtime.antigravityReplay !== undefined &&
    antigravityUsesReplay(body)
  );
}

function subscriptionAccountId(grant: ResolvedGrant): string {
  return grant.spend.custody === 'subscription' ? grant.spend.accountId : '';
}

export async function observeSubscriptionAnswer(
  grant: ResolvedGrant,
  body: JsonObject,
  answer: Response,
  runtime: ObservationRuntime,
  scope: ObservationScope,
): Promise<Response> {
  if (observesAntigravity(grant, runtime, body)) {
    const key = antigravityReplayKey(subscriptionAccountId(grant), body, scope.replayScopeId);

    return observeAntigravityReasoning(
      answer,
      (items) => runtime.antigravityReplay?.commit(key, items),
      () => runtime.antigravityReplay?.clear(key),
      runtime.antigravityReplay?.snapshot(key),
    );
  }

  if (!observesCodex(grant, runtime, scope.sourceDialect)) {
    return observeClaudeAnswer(grant, answer, runtime, scope.sessionId);
  }

  const key = codexReplayKey(body, scope.replayScopeId);

  return observeCodexReasoning(
    answer,
    (output) => runtime.codexReplay?.commit(key, output),
    () => runtime.codexReplay?.clear(key),
  );
}
