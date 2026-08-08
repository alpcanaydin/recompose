import type { SpendGrant } from '@recompose/contracts';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

export function pluginCredential(grant: ResolvedGrant): Uint8Array {
  return grant.spend.custody === 'open'
    ? new Uint8Array()
    : new TextEncoder().encode(grant.spend.credential);
}

export function pluginAccountId(grant: ResolvedGrant): string {
  return grant.spend.custody === 'open' ? '' : (grant.spend.accountId ?? '');
}
