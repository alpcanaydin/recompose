import type { SubscriptionProviderId } from '@recompose/contracts';

import type { ProviderDialect } from '../gateway-wire';
import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';

import { providerObservability, providerRequestId } from '../provider/provider-observability';

type SubscriptionSend = (
  provider: SubscriptionProviderId,
  request: ProviderRequest,
) => Promise<Response>;

function providerDialect(provider: SubscriptionProviderId): ProviderDialect {
  if (provider === 'anthropic') return 'anthropic';
  if (provider === 'antigravity') return 'gemini';

  return 'responses';
}

export async function sendObservedSubscription(
  provider: SubscriptionProviderId,
  accountId: string,
  body: JsonObject,
  request: ProviderRequest,
  send: SubscriptionSend,
): Promise<Response> {
  const span = providerObservability().start({
    provider,
    model: typeof body['model'] === 'string' ? body['model'] : '',
    accountId,
    dialect: providerDialect(provider),
    method: 'POST',
    requestId: providerRequestId(new Headers(request.headers)),
  });

  return span.observe(await send(provider, request));
}
