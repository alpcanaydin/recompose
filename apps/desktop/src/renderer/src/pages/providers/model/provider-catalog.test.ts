import type { CredentialedAccount } from '@recompose/contracts';

import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';

import type { CatalogEntry, ConnectionWay } from './provider-catalog';

import {
  awaitedFor,
  catalogEntries,
  checkableKey,
  keyHostFor,
  markFor,
  keyKindOf,
  keyTitleFor,
  offerFor,
  offeredUnder,
  signInProviderOf,
  subscriptionTitleFor,
  keyShapeHintFor,
} from './provider-catalog';

const anyWay = fc.constantFrom<ConnectionWay[]>('subscription', 'api-key', 'aggregator');

const anyOffer = fc.record({
  way: anyWay,
  title: fc.string(),
  benefit: fc.string(),
});

const anyCatalog = fc.uniqueArray(
  fc.record({
    id: fc.constantFrom('anthropic' as const, 'openai' as const, 'openrouter' as const),
    name: fc.string(),
    offers: fc.uniqueArray(anyOffer, { minLength: 1, selector: (offer) => offer.way }),
  }),
  { selector: (entry) => entry.id },
);

function storedKey(overrides: Partial<CredentialedAccount> = {}): CredentialedAccount {
  return {
    id: 'a1',
    provider: 'anthropic',
    kind: 'api-key',
    label: 'build',
    credentialRef: 'c1',
    ...overrides,
  };
}

function offered(id: CatalogEntry['id']): CatalogEntry {
  const entry = catalogEntries.find((candidate) => candidate.id === id);

  if (entry === undefined) {
    throw new Error(`the catalog offers no ${id}`);
  }

  return entry;
}

test('the catalog offers a provider under every way that provider connects', () => {
  expect(offered('anthropic').name).toBe('Anthropic');
  expect(offered('anthropic').offers.map((offer) => offer.way)).toEqual([
    'subscription',
    'api-key',
  ]);
});

test('a subscription offer reads as the plan product rather than the vendor', () => {
  expect(offerFor(offered('anthropic'), 'subscription')).toEqual({
    way: 'subscription',
    title: 'Claude',
    benefit: 'Sign in with your Pro or Max plan',
  });
  expect(offerFor(offered('openai'), 'subscription')).toEqual({
    way: 'subscription',
    title: 'Codex',
    benefit: 'Sign in with your ChatGPT plan',
  });
});

test('a key offer names the endpoint the key is spent against', () => {
  expect(offerFor(offered('anthropic'), 'api-key')?.title).toBe('Anthropic API');
  expect(offerFor(offered('anthropic'), 'api-key')?.benefit).toBe(
    'api.anthropic.com with your key',
  );
});

test('a provider that only ever takes a key offers no way to sign in', () => {
  expect(offered('openrouter').offers.map((offer) => offer.way)).toEqual(['aggregator']);
});

test('a way keeps the providers that connect by it and drops the rest', () => {
  expect(offeredUnder(catalogEntries, 'subscription').map((entry) => entry.id)).toEqual([
    'anthropic',
    'openai',
  ]);
  expect(offeredUnder(catalogEntries, 'aggregator').map((entry) => entry.id)).toEqual([
    'openrouter',
  ]);
});

test('a stored subscription reads as the plan product its provider sells', () => {
  expect(subscriptionTitleFor('anthropic')).toBe('Claude');
  expect(subscriptionTitleFor('openai')).toBe('Codex');
  expect(subscriptionTitleFor('openrouter')).toBe('OpenRouter');
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

test('the subscriptions nothing connects yet still stand in the catalog, named and explained', () => {
  expect(awaitedFor('subscription').map((awaited) => awaited.name)).toEqual([
    'GitHub Copilot',
    'Kimi Code',
    'GLM Coding Plan',
    'Qwen Coding Plan',
    'MiniMax Coding Plan',
  ]);

  for (const awaited of awaitedFor('subscription')) {
    expect(awaited.benefit.length).toBeGreaterThan(0);
  }
});

test('the local servers nothing runs yet stand in the catalog the same way', () => {
  expect(awaitedFor('local').map((awaited) => awaited.name)).toEqual([
    'Ollama',
    'LM Studio',
    'llama.cpp',
    'vLLM',
  ]);
});

test('the key providers nothing connects yet stand in the catalog, each naming what it waits on', () => {
  expect(awaitedFor('api-key').map((awaited) => awaited.name)).toEqual([
    'Gemini API',
    'Mistral',
    'xAI Grok',
    'DeepSeek',
    'Moonshot AI',
    'Qwen',
    'Custom endpoint',
  ]);

  for (const awaited of awaitedFor('api-key')) {
    expect(awaited.benefit).toMatch(/Waits on/);
  }
});

test('the kind whose catalog is complete awaits nothing', () => {
  expect(awaitedFor('aggregator')).toEqual([]);
});

test('a stored key reads as the product its catalog entry was picked as', () => {
  expect(keyTitleFor('anthropic')).toBe('Anthropic API');
  expect(keyTitleFor('openai')).toBe('OpenAI API');
  expect(keyTitleFor('openrouter')).toBe('OpenRouter');
});

test('a stored key the catalog never offered reads as the provider it was stored under', () => {
  expect(keyTitleFor('mistral')).toBe('mistral');
});

test('a key provider names the one host its key is spent against', () => {
  expect(keyHostFor('anthropic')).toBe('api.anthropic.com');
  expect(keyHostFor('openai')).toBe('api.openai.com');
});

test('a provider whose key reaches many hosts names none of them', () => {
  expect(keyHostFor('openrouter')).toBeUndefined();
});

test('a provider the catalog offers is drawn with its own mark', () => {
  expect(markFor('anthropic')).toBe('anthropic');
  expect(markFor('openrouter')).toBe('openrouter');
});

test('a provider the catalog never offered is drawn with no mark at all', () => {
  expect(markFor('mistral')).toBeUndefined();
});

test('a check can answer for a key whose provider the probe knows', () => {
  expect(checkableKey(storedKey())).toBe(true);
  expect(checkableKey(storedKey({ provider: 'openai' }))).toBe(true);
});

test('a check can answer for neither an aggregator key nor a provider the probe never learned', () => {
  expect(checkableKey(storedKey({ provider: 'openrouter', kind: 'aggregator' }))).toBe(false);
  expect(checkableKey(storedKey({ provider: 'mistral' }))).toBe(false);
});

test.prop([anyCatalog, anyWay])(
  'a way answers a subset of what it was handed, every one offering that way',
  (entries: readonly CatalogEntry[], way) => {
    const under = offeredUnder(entries, way);

    expect(under.every((entry) => entries.includes(entry))).toBe(true);
    expect(under.every((entry) => offerFor(entry, way) !== undefined)).toBe(true);
  },
);

test('a key field hints at the shape the provider hands out', () => {
  expect(keyShapeHintFor('anthropic')).toBe('sk-ant-…');
  expect(keyShapeHintFor('openai')).toBe('sk-…');
});

test('a provider whose key shape the catalog never learned hints at nothing', () => {
  expect(keyShapeHintFor('openrouter')).toBeUndefined();
  expect(keyShapeHintFor('mistral')).toBeUndefined();
});
