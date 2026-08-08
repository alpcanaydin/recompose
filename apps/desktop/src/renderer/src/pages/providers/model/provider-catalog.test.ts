import type { CredentialedAccount } from '@recompose/contracts';

import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';

import type { CatalogEntry, ConnectionWay } from './provider-catalog';

import {
  catalogEntries,
  checkableKey,
  keyHostFor,
  markFor,
  keyKindOf,
  keyTitleFor,
  localRuntimeOf,
  offerFor,
  offeredUnder,
  signInProviderOf,
  subscriptionMarkFor,
  subscriptionTitleFor,
  keyShapeHintFor,
} from './provider-catalog';

const anyWay = fc.constantFrom<ConnectionWay[]>('subscription', 'api-key', 'aggregator', 'local');

const anyOffer = fc.record({
  way: anyWay,
  title: fc.string(),
  benefit: fc.string(),
});

const anyCatalog = fc.uniqueArray(
  fc.record({
    id: fc.constantFrom(
      'anthropic' as const,
      'openai' as const,
      'openrouter' as const,
      'ollama' as const,
    ),
    name: fc.string(),
    lead: fc.constant({ mark: 'anthropic' as const }),
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

test('the one runtime this machine can serve offers the local way and nothing else', () => {
  expect(offered('ollama').offers).toEqual([
    {
      way: 'local',
      title: 'Ollama',
      benefit: '127.0.0.1:11434, models on this machine',
    },
  ]);
});

test('a way keeps the providers that connect by it and drops the rest', () => {
  expect(offeredUnder(catalogEntries, 'subscription').map((entry) => entry.id)).toEqual([
    'anthropic',
    'openai',
  ]);
  expect(offeredUnder(catalogEntries, 'aggregator').map((entry) => entry.id)).toEqual([
    'openrouter',
  ]);
  expect(offeredUnder(catalogEntries, 'local').map((entry) => entry.id)).toEqual(['ollama']);
});

test('a stored subscription reads as the plan product its provider sells', () => {
  expect(subscriptionTitleFor('anthropic')).toBe('Claude');
  expect(subscriptionTitleFor('openai')).toBe('Codex');
  expect(subscriptionTitleFor('antigravity')).toBe('Gemini');
  expect(subscriptionMarkFor('antigravity')).toBe('gemini');
  expect(subscriptionTitleFor('openrouter')).toBe('OpenRouter');
});

test('a provider that signs in names the provider identity it signs in under', () => {
  expect(signInProviderOf(offered('openai'))).toBe('openai');
});

test('a provider that never signs in names nobody to sign in as', () => {
  expect(signInProviderOf(offered('openrouter'))).toBeUndefined();
  expect(signInProviderOf(offered('ollama'))).toBeUndefined();
});

test('a provider that serves this machine names the runtime it would be stored as', () => {
  expect(localRuntimeOf(offered('ollama'))).toBe('ollama');
});

test('a provider that reaches off the machine names no runtime to detect', () => {
  expect(localRuntimeOf(offered('anthropic'))).toBeUndefined();
  expect(localRuntimeOf(offered('openrouter'))).toBeUndefined();
});

test('a provider that takes a key names the kind that key is held under', () => {
  expect(keyKindOf(offered('anthropic'))).toBe('api-key');
  expect(keyKindOf(offered('openrouter'))).toBe('aggregator');
});

test('a runtime that holds no credential names no kind to hold one under', () => {
  expect(keyKindOf(offered('ollama'))).toBeUndefined();
});

test('a runtime that holds no credential reads as no key product either', () => {
  expect(keyTitleFor('ollama')).toBe('ollama');
});

test('every line the catalog prints stays clear of the dash this project never writes', () => {
  const lines = catalogEntries.flatMap((entry) => [
    entry.name,
    ...entry.offers.flatMap((offer) => [offer.title, offer.benefit]),
  ]);

  expect(lines.filter((line) => line.includes('—'))).toEqual([]);
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
  expect(markFor('ollama')).toBe('ollama');
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
  expect(keyShapeHintFor('openai')).toBe('sk-proj-…');
});

test('the aggregator field hints at the one shape its vendor documents', () => {
  expect(keyShapeHintFor('openrouter')).toBe('sk-or-v1-…');
});

test('a provider whose key shape the catalog never learned hints at nothing', () => {
  expect(keyShapeHintFor('ollama')).toBeUndefined();
  expect(keyShapeHintFor('mistral')).toBeUndefined();
});
