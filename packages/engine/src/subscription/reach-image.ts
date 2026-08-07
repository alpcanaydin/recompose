import type { JsonObject } from '../gateway-wire';
import type { ResolvedGrant, SubscriptionRuntime } from './reach';

import { codexImageProviderRequest } from './codex-image-request';
import {
  readySubscriptionCredential,
  refreshedAndPersisted,
  shouldRefreshUnauthorized,
} from './reach-credential';

type ImagePath = '/images/generations' | '/images/edits';

export async function reachCodexImage(
  grant: ResolvedGrant,
  path: ImagePath,
  body: JsonObject,
  sourceHeaders: Headers,
  stream: boolean,
  runtime: SubscriptionRuntime,
): Promise<Response> {
  if (grant.spend.custody !== 'subscription' || grant.spend.provider !== 'openai') {
    throw new Error('a non-Codex subscription reached the image transport');
  }

  const ready = await readySubscriptionCredential(grant.spend, runtime);
  const request = codexImageProviderRequest(
    grant.providerOrigin,
    path,
    body,
    ready.credential,
    sourceHeaders,
    stream,
  );
  const answer = await runtime.send('openai', request);

  if (!shouldRefreshUnauthorized(answer, ready.credential)) return answer;

  const retried = await refreshedAndPersisted(grant.spend, ready.blob, runtime);

  return runtime.send(
    'openai',
    codexImageProviderRequest(
      grant.providerOrigin,
      path,
      body,
      retried.credential,
      sourceHeaders,
      stream,
    ),
  );
}
