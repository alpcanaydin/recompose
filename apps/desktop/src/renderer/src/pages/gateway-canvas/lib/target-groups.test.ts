import type { AccountsDocument } from '@recompose/contracts';

import { expect, test } from 'vitest';

import { targetGroups } from './target-groups';

type StoredAccounts = AccountsDocument['accounts'];

const everyKind: StoredAccounts = [
  { id: 's1', provider: 'anthropic', kind: 'subscription', label: 'Claude' },
  { id: 'k1', provider: 'anthropic', kind: 'api-key', label: 'Work key', credentialRef: 'c1' },
  { id: 'g1', provider: 'openrouter', kind: 'aggregator', label: 'Router', credentialRef: 'c2' },
  { id: 'l1', provider: 'ollama', kind: 'local', address: 'http://127.0.0.1:11434' },
];

test('the offered accounts stand under the kinds the registry holds them as', () => {
  expect(targetGroups(everyKind).map((group) => group.heading)).toEqual([
    'API Keys',
    'Aggregators',
    'Local Runtimes',
  ]);
});

test('a subscription account stands under no heading, because none of them offers one', () => {
  const headings = targetGroups(everyKind).map((group) => group.heading);

  expect(headings).not.toContain('Subscriptions');
});

test('a kind holding nothing that can be a target stands as no group at all', () => {
  const keysOnly = everyKind.filter((account) => account.kind === 'api-key');

  expect(targetGroups(keysOnly).map((group) => group.heading)).toEqual(['API Keys']);
});

test('a stored key offers the name a person filed it under, and its vendor mark', () => {
  const [keys] = targetGroups(everyKind);

  expect(keys?.options).toEqual([{ id: 'k1', name: 'Work key', mark: 'anthropic' }]);
});

test('a stored runtime offers the server it is and the address it answers at', () => {
  const runtimes = targetGroups(everyKind).at(-1);

  expect(runtimes?.options).toEqual([
    { id: 'l1', name: 'Ollama', mark: 'ollama', detail: 'http://127.0.0.1:11434' },
  ]);
});

test('a registry holding nothing offers no group for anyone to search', () => {
  expect(targetGroups([])).toEqual([]);
});
