import type { JsonObject, ProxyDialect } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';
import type { CodexReasoningReplay } from './codex-replay';
import type { ParsedSubscriptionCredential } from './credentials';

import { codexPromptCacheKey } from './codex-prompt-cache';
import { codexProviderRequest } from './codex-request';

type CodexReachOptions = {
  providerOrigin: string;
  body: JsonObject;
  credential: ParsedSubscriptionCredential;
  replay: CodexReasoningReplay | undefined;
  replayScopeId: string;
  sessionId: string;
  sourceDialect: ProxyDialect;
  responsesLite: boolean;
  requestId: string;
};

export function codexReachRequest(options: CodexReachOptions): ProviderRequest {
  const body = replayedBody(options);

  return codexProviderRequest(
    options.providerOrigin,
    body,
    options.credential,
    options.requestId,
    options.responsesLite,
    codexPromptCacheKey(options.body, options.replayScopeId, options.sessionId),
  );
}

function replayedBody(options: CodexReachOptions): JsonObject {
  if (options.sourceDialect !== 'anthropic' || options.replay === undefined) return options.body;

  return options.replay.inject(codexReplayKey(options.body, options.replayScopeId), options.body);
}

function codexReplayKey(body: JsonObject, sessionId: string): string {
  const model = typeof body['model'] === 'string' ? body['model'] : '';

  return `${model}\0${sessionId}`;
}
