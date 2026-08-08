import type { JsonObject } from '../gateway-wire';
import type { ResolvedGrant, SubscriptionRuntime } from './reach';

import { codexProviderRequest } from './codex-request';
import {
  readySubscriptionCredential,
  refreshedAndPersisted,
  shouldRefreshUnauthorized,
} from './reach-credential';

function compactRequest(
  grant: ResolvedGrant,
  body: JsonObject,
  access: Awaited<ReturnType<typeof readySubscriptionCredential>>['credential'],
  sessionId: string,
) {
  return codexProviderRequest(
    grant.providerOrigin,
    body,
    access,
    sessionId,
    false,
    sessionId,
    true,
  );
}

export async function reachCodexCompact(
  grant: ResolvedGrant,
  body: JsonObject,
  runtime: SubscriptionRuntime,
  sessionId = runtime.randomUUID(),
): Promise<Response> {
  if (grant.spend.custody !== 'subscription' || grant.spend.provider !== 'openai') {
    throw new Error('a non-Codex subscription reached the compact transport');
  }

  const ready = await readySubscriptionCredential(grant.spend, runtime);
  const answer = await runtime.send(
    'openai',
    compactRequest(grant, body, ready.credential, sessionId),
    grant.spend.transportPolicy,
  );

  if (!shouldRefreshUnauthorized(answer, ready.credential)) return answer;

  const retried = await refreshedAndPersisted(grant.spend, ready.blob, runtime);

  return runtime.send(
    'openai',
    compactRequest(grant, body, retried.credential, sessionId),
    grant.spend.transportPolicy,
  );
}
