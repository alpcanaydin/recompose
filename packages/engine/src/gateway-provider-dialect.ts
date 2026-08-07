import type { SpendGrant } from '@recompose/contracts';

import type { ProviderDialect, ProxyDialect } from './gateway-wire';

import { credentialedDialect } from './provider/credentialed-target';

function subscriptionDialect(provider: string): ProviderDialect {
  return provider === 'anthropic'
    ? 'anthropic'
    : provider === 'antigravity'
      ? 'gemini'
      : 'responses';
}

export function dialectFor(grant: SpendGrant, sourceDialect: ProxyDialect): ProviderDialect {
  if (grant.verdict !== 'resolved') return 'chat-completions';
  if (grant.spend.custody === 'open') return 'chat-completions';

  return grant.spend.custody === 'credentialed'
    ? credentialedDialect(grant.spend.provider, sourceDialect)
    : subscriptionDialect(grant.spend.provider);
}
