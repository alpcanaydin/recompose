import { proxyFetchBoundMs } from '@recompose/contracts';

import type { AIStudioRelay, RelayRequest } from './ai-studio-relay';

export async function reachAIStudio(
  channelId: string | undefined,
  request: RelayRequest,
  relay?: AIStudioRelay,
): Promise<Response | null> {
  if (channelId === undefined || relay === undefined) return null;

  return relay.request(channelId, request, AbortSignal.timeout(proxyFetchBoundMs));
}
