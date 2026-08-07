import type { SpendGrant } from '@recompose/contracts';

import { proxyFetchBoundMs } from '@recompose/contracts';

import type { Crossing, JsonObject } from '../gateway-wire';
import type { AIStudioRelay } from './ai-studio-relay';

import { credentialedRequestBody, credentialedRequestUrl } from './credentialed-target';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

export async function reachAIStudio(
  crossing: Crossing,
  grant: ResolvedGrant,
  body: JsonObject,
  relay?: AIStudioRelay,
): Promise<Response | null> {
  if (grant.spend.custody !== 'credentialed' || relay === undefined) return null;

  const channelId = grant.spend.accountId;

  if (channelId === undefined) return null;

  return relay.request(
    channelId,
    {
      method: 'POST',
      url: credentialedRequestUrl(grant, crossing),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentialedRequestBody(grant, crossing, body)),
    },
    AbortSignal.timeout(proxyFetchBoundMs),
  );
}
