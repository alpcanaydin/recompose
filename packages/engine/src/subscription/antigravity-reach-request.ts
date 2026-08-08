import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';

import { replayedAntigravityBody } from './antigravity-replay';
import { antigravityProviderRequest } from './antigravity-request';

type AntigravityReachOptions = {
  providerOrigin: string;
  body: JsonObject;
  credential: ParsedSubscriptionCredential;
  accountId: string;
  replayScopeId: string;
  sessionId: string;
  replay: Parameters<typeof replayedAntigravityBody>[0];
  requestId: string;
  now: number;
  sensitiveWords: readonly string[] | undefined;
};

export function antigravityReachRequest(options: AntigravityReachOptions): ProviderRequest {
  const replayed = replayedAntigravityBody(
    options.replay,
    options.accountId,
    options.body,
    options.replayScopeId,
  );

  return antigravityProviderRequest(
    options.providerOrigin,
    replayed,
    options.credential,
    { sessionId: options.sessionId, requestId: options.requestId },
    options.now,
    options.sensitiveWords,
  );
}
