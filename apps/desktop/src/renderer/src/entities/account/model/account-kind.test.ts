import type { AccountsDocument } from '@recompose/contracts';

import { expect, test } from 'vitest';

import { accountKindTitle, accountKinds, accountsOfKind } from './account-kind';

type StoredAccount = AccountsDocument['accounts'][number];

function account(id: string, kind: StoredAccount['kind']): StoredAccount {
  if (kind === 'subscription') {
    return { id, provider: 'anthropic', kind, label: id };
  }

  if (kind === 'local') {
    return { id, provider: 'ollama', kind, address: 'http://127.0.0.1:11434' };
  }

  return { id, provider: 'anthropic', kind, label: id, credentialRef: `c-${id}` };
}

test('the kinds a person can browse are every kind the contract names', () => {
  expect(accountKinds).toEqual(['subscription', 'api-key', 'aggregator', 'local']);
});

test('every kind reads as a name rather than as its stored token', () => {
  expect(accountKinds.map(accountKindTitle)).toEqual([
    'Subscriptions',
    'API Keys',
    'Aggregators',
    'Local Runtimes',
  ]);
});

test('the local destination gathers the runtimes the document stores', () => {
  const stored = [account('a1', 'api-key'), account('a2', 'local')];

  expect(accountsOfKind(stored, 'local')).toEqual([stored[1]]);
});

test('a kind gathers the stored accounts of that kind and no others', () => {
  const stored = [
    account('a1', 'api-key'),
    account('a2', 'subscription'),
    account('a3', 'api-key'),
  ];

  expect(accountsOfKind(stored, 'api-key')).toEqual([stored[0], stored[2]]);
});

test('a kind nothing is stored under gathers nothing', () => {
  expect(accountsOfKind([account('a1', 'api-key')], 'aggregator')).toEqual([]);
});
