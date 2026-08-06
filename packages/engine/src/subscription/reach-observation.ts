import type { SpendGrant } from '@recompose/contracts';

import type { JsonObject, ProxyDialect } from '../gateway-wire';
import type { ClaudeDiagnostics } from './claude-diagnostics';
import type { CodexReasoningReplay } from './codex-replay';

import { observeClaudeDiagnostics } from './claude-diagnostics';
import { observeCodexReasoning } from './codex-replay';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type ObservationRuntime = {
  diagnostics: ClaudeDiagnostics;
  codexReplay?: CodexReasoningReplay;
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

export async function observeSubscriptionAnswer(
  grant: ResolvedGrant,
  body: JsonObject,
  answer: Response,
  runtime: ObservationRuntime,
  sessionId: string,
  sourceDialect: ProxyDialect,
): Promise<Response> {
  if (!observesCodex(grant, runtime, sourceDialect)) {
    return observeClaudeAnswer(grant, answer, runtime, sessionId);
  }

  const key = codexReplayKey(body, sessionId);

  return observeCodexReasoning(
    answer,
    (output) => runtime.codexReplay?.commit(key, output),
    () => runtime.codexReplay?.clear(key),
  );
}
