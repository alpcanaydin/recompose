import { describe, expect, test } from 'vitest';

import { ACCOUNTS_VERSION, loadAccountsDocument } from './accounts';

const subscription = {
  id: 'acc-claude-max',
  provider: 'anthropic',
  kind: 'subscription',
  label: 'Claude Max',
} as const;

describe('subscription account transport policy', () => {
  test('validates inherit, direct, and proxy modes', () => {
    for (const transportPolicy of [
      { mode: 'inherit' },
      { mode: 'direct' },
      { mode: 'proxy', url: 'socks5://proxy.example.com:1080' },
    ] as const) {
      const stored = {
        schemaVersion: ACCOUNTS_VERSION,
        accounts: [{ ...subscription, transportPolicy }],
      };

      expect(loadAccountsDocument(stored)).toEqual(stored);
    }
  });

  test('rejects unsupported URLs and embedded credentials', () => {
    for (const url of ['ftp://proxy.example.com', 'http://user:secret@proxy.example.com']) {
      expect(() =>
        loadAccountsDocument({
          schemaVersion: ACCOUNTS_VERSION,
          accounts: [{ ...subscription, transportPolicy: { mode: 'proxy', url } }],
        }),
      ).toThrow();
    }
  });
});
