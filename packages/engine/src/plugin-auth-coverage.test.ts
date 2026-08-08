import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import { pluginAccountId, pluginCredential } from './plugin-auth';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

function aResolvedGrant(spend: ResolvedGrant['spend']): ResolvedGrant {
  return { verdict: 'resolved', providerOrigin: 'plugin://provider', spend };
}

describe('the credential a plugin executor is handed', () => {
  it('should spell a credentialed secret as its bytes', () => {
    const grant = aResolvedGrant({
      custody: 'credentialed',
      provider: 'plugin-provider',
      credential: '{"token":"secret"}',
      accountId: 'acc-plugin',
    });

    expect(new TextDecoder().decode(pluginCredential(grant))).toBe('{"token":"secret"}');
  });

  it('should hand an open target no credential at all', () => {
    expect(pluginCredential(aResolvedGrant({ custody: 'open' }))).toEqual(new Uint8Array());
  });
});

describe('the account a plugin executor is billed against', () => {
  it('should name the account a credentialed grant carries', () => {
    const grant = aResolvedGrant({
      custody: 'credentialed',
      provider: 'plugin-provider',
      credential: 'secret',
      accountId: 'acc-plugin',
    });

    expect(pluginAccountId(grant)).toBe('acc-plugin');
  });

  it('should name no account when a credentialed grant carries none', () => {
    const grant = aResolvedGrant({
      custody: 'credentialed',
      provider: 'plugin-provider',
      credential: 'secret',
    });

    expect(pluginAccountId(grant)).toBe('');
  });

  it('should name no account for an open target', () => {
    expect(pluginAccountId(aResolvedGrant({ custody: 'open' }))).toBe('');
  });

  it('should name the account a subscription grant carries', () => {
    const grant = aResolvedGrant({
      custody: 'subscription',
      provider: 'anthropic',
      accountId: 'acc-claude',
      credential: '{"access_token":"live"}',
    });

    expect(pluginAccountId(grant)).toBe('acc-claude');
  });
});
