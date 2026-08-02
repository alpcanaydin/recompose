import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';

import type { CatalogEntry, ConnectionWay } from './provider-catalog';

import {
  catalogEntries,
  catalogGroups,
  keyKindOf,
  narrowedCatalog,
  signInProviderOf,
} from './provider-catalog';

const anyWay = fc.constantFrom<ConnectionWay[]>('subscription', 'api-key', 'aggregator');

const anyCatalog = fc.uniqueArray(
  fc.record({
    id: fc.constantFrom('anthropic' as const, 'openai' as const, 'openrouter' as const),
    name: fc.string(),
    ways: fc.uniqueArray(anyWay, { minLength: 1 }),
  }),
  { selector: (entry) => entry.id },
);

const anyNarrowing = fc.record({
  search: fc.string(),
  way: fc.option(anyWay, { nil: undefined }),
});

function offered(id: CatalogEntry['id']): CatalogEntry {
  const entry = catalogEntries.find((candidate) => candidate.id === id);

  if (entry === undefined) {
    throw new Error(`the catalog offers no ${id}`);
  }

  return entry;
}

test('the catalog offers a provider under every way that provider connects', () => {
  expect(offered('anthropic').name).toBe('Anthropic');
  expect(offered('anthropic').ways).toEqual(['subscription', 'api-key']);
});

test('a provider that only ever takes a key offers no way to sign in', () => {
  expect(offered('openrouter').ways).toEqual(['aggregator']);
});

test('a provider that signs in names the provider identity it signs in under', () => {
  expect(signInProviderOf(offered('openai'))).toBe('openai');
});

test('a provider that never signs in names nobody to sign in as', () => {
  expect(signInProviderOf(offered('openrouter'))).toBeUndefined();
});

test('a provider that takes a key names the kind that key is held under', () => {
  expect(keyKindOf(offered('anthropic'))).toBe('api-key');
  expect(keyKindOf(offered('openrouter'))).toBe('aggregator');
});

test('the catalog gathers under the name each way goes by on screen', () => {
  expect(catalogGroups(catalogEntries).map((group) => group.title)).toEqual([
    'Subscriptions',
    'Aggregators',
  ]);
});

test('a provider that connects two ways stands once, under the way it leads with', () => {
  const groups = catalogGroups(catalogEntries);
  const under = (way: ConnectionWay) =>
    groups.find((group) => group.way === way)?.entries.map((entry) => entry.id);

  expect(under('subscription')).toEqual(['anthropic', 'openai']);
  expect(under('api-key')).toBeUndefined();
});

test('a way asked for gathers the providers that lead with another way under it', () => {
  const narrowed = narrowedCatalog(catalogEntries, { search: '', way: 'api-key' });

  expect(catalogGroups(narrowed, 'api-key')).toEqual([
    { way: 'api-key', title: 'API Keys', entries: [offered('anthropic'), offered('openai')] },
  ]);
});

test('a way nothing is left under drops its heading rather than standing empty', () => {
  const narrowed = narrowedCatalog(catalogEntries, { search: 'openrouter' });

  expect(catalogGroups(narrowed).map((group) => group.way)).toEqual(['aggregator']);
});

test('searching keeps the providers whose name carries the text, whatever its case', () => {
  expect(narrowedCatalog(catalogEntries, { search: 'ANTHRO' })).toEqual([offered('anthropic')]);
});

test('searching on nothing but blanks keeps every provider rather than none', () => {
  expect(narrowedCatalog(catalogEntries, { search: '   ' })).toEqual(catalogEntries);
});

test('a way keeps the providers that connect by it and drops the rest', () => {
  expect(narrowedCatalog(catalogEntries, { search: '', way: 'aggregator' })).toEqual([
    offered('openrouter'),
  ]);
});

test('a search and a way narrow together rather than one overriding the other', () => {
  expect(narrowedCatalog(catalogEntries, { search: 'open', way: 'subscription' })).toEqual([
    offered('openai'),
  ]);
});

test('a narrowing nothing answers keeps nothing rather than falling back to everything', () => {
  expect(narrowedCatalog(catalogEntries, { search: 'mistral' })).toEqual([]);
});

test.prop([anyCatalog, anyNarrowing])(
  'a narrowing answers a subset of what it was handed, whatever it is asked for',
  (entries: readonly CatalogEntry[], narrowing) => {
    const narrowed = narrowedCatalog(entries, narrowing);

    expect(narrowed.every((entry) => entries.includes(entry))).toBe(true);
    expect(new Set(narrowed).size).toBe(narrowed.length);
  },
);
