import { expect, test } from 'vitest';

import { BoundedLRU } from './bounded-lru';
import { SignatureReplayCache } from './signature-replay-cache';

test('TestBoundedLRUEvictsLeastRecentlyUsed', () => {
  const cache = new BoundedLRU<string, number>(2);

  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a');
  cache.set('c', 3);

  expect(cache.get('a')).toBe(1);
  expect(cache.get('b')).toBeUndefined();
});

test('TestBoundedLRUCreatesOneValuePerKeyConcurrently', async () => {
  const cache = new BoundedLRU<string, number>(2);
  let creates = 0;
  const create = async () => {
    await Promise.resolve();
    creates += 1;

    return 7;
  };

  expect(
    await Promise.all([cache.getOrCreate('a', create), cache.getOrCreate('a', create)]),
  ).toEqual([7, 7]);
  expect(creates).toBe(1);
});

test('TestCacheSignature_BasicStorageAndRetrieval', () => {
  const cache = signatureCache();

  expect(cache.set('gemini', 'text', signature('one'))).toBe(true);
  expect(cache.get('gemini', 'text')).toBe(signature('one'));
});

test('TestCacheSignature_DifferentModelGroups', () => {
  const cache = signatureCache();

  cache.set('a', 'text', signature('one'));
  cache.set('b', 'text', signature('two'));
  expect(cache.get('a', 'text')).not.toBe(cache.get('b', 'text'));
});

test('TestCacheSignature_NotFound', () => {
  expect(signatureCache().get('gemini', 'missing')).toBeUndefined();
});

test('TestCacheSignature_EmptyInputs', () => {
  expect(signatureCache().set('', '', signature('one'))).toBe(false);
});

test('TestCacheSignature_ShortSignatureRejected', () => {
  expect(signatureCache().set('gemini', 'text', 'short')).toBe(false);
});

test('TestClearSignatureCache_ModelGroup', () => {
  const cache = signatureCache();

  cache.set('a', 'text', signature('one'));
  cache.set('b', 'text', signature('two'));
  cache.clearModel('a');
  expect(cache.get('a', 'text')).toBeUndefined();
  expect(cache.get('b', 'text')).toBeDefined();
});

test('TestClearSignatureCache_AllSessions', () => {
  const cache = signatureCache();

  cache.set('a', 'text', signature('one'));
  cache.clearAll();
  expect(cache.get('a', 'text')).toBeUndefined();
});

test('TestHasValidSignature', () => {
  const cache = signatureCache();

  cache.set('a', 'text', signature('one'));
  expect(cache.hasValidSignature('a', 'text')).toBe(true);
});

test('TestCacheSignature_TextHashCollisionResistance', () => {
  const cache = signatureCache();

  cache.set('a', 'ab', signature('one'));
  cache.set('a', 'ba', signature('two'));
  expect(cache.get('a', 'ab')).not.toBe(cache.get('a', 'ba'));
});

test('TestCacheSignature_UnicodeText', () => {
  const cache = signatureCache();

  cache.set('a', '北京天气 ☀️', signature('unicode'));
  expect(cache.get('a', '北京天气 ☀️')).toBe(signature('unicode'));
});

test('TestCacheSignature_Overwrite', () => {
  const cache = signatureCache();

  cache.set('a', 'text', signature('one'));
  cache.set('a', 'text', signature('two'));
  expect(cache.get('a', 'text')).toBe(signature('two'));
});

test('TestCacheSignature_ExpirationLogic', () => {
  let now = 0;
  const cache = new SignatureReplayCache(10, () => now);

  cache.set('a', 'text', signature('one'));
  now = 11;
  expect(cache.get('a', 'text')).toBeUndefined();
});

function signature(seed: string): string {
  return `valid-signature-${seed}-123456`;
}

function signatureCache(): SignatureReplayCache {
  return new SignatureReplayCache(1_000);
}
