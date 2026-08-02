import type { AccountsDocument } from '@recompose/contracts';

import { expect, test } from 'vitest';

import { accountKindTitle, accountKinds, accountsOfKind } from './account-kind';

function account(id: string, kind: AccountsDocument['accounts'][number]['kind']) {
  return kind === 'subscription'
    ? { id, provider: 'anthropic' as const, kind, label: id }
    : { id, provider: 'anthropic', kind, label: id, credentialRef: `c-${id}` };
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

test('a kind no account can be stored under gathers nothing rather than refusing', () => {
  expect(accountsOfKind([account('a1', 'api-key')], 'local')).toEqual([]);
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
