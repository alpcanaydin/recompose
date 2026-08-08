import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { SignatureReplayCache } from './signature-replay-cache';

const aSignature = 'valid-signature-abcdef123456';

function aCache(): SignatureReplayCache {
  return new SignatureReplayCache(1_000);
}

describe('the model group and text a signature is filed under', () => {
  const unkeyable: [string, string, string][] = [
    ['a blank model group', '', 'some text'],
    ['a model group that is only whitespace', '   ', 'some text'],
    ['empty text', 'gemini', ''],
    ['a blank model group and empty text', '', ''],
  ];

  test.each(unkeyable)('%s cannot be looked up', (_name, modelGroup, text) => {
    const cache = aCache();

    cache.set('gemini', 'some text', aSignature);

    expect(cache.get(modelGroup, text)).toBeUndefined();
    expect(cache.hasValidSignature(modelGroup, text)).toBe(false);
  });

  test.each(unkeyable)('%s cannot be filed either', (_name, modelGroup, text) => {
    expect(aCache().set(modelGroup, text, aSignature)).toBe(false);
  });

  test('a model group is looked up by its trimmed name', () => {
    const cache = aCache();

    cache.set('  gemini  ', 'some text', aSignature);

    expect(cache.get('gemini', 'some text')).toBe(aSignature);
  });
});

describe('the signatures a replay cache is willing to hold', () => {
  test.prop([fc.string({ minLength: 16, maxLength: 64 })])(
    'a signature at or above the minimum length comes back exactly as it was filed',
    (signature) => {
      const cache = aCache();

      expect(cache.set('gemini', 'some text', signature)).toBe(true);
      expect(cache.get('gemini', 'some text')).toBe(signature);
    },
  );

  test.prop([fc.string({ maxLength: 15 })])(
    'a signature under the minimum length is turned away and never becomes readable',
    (signature) => {
      const cache = aCache();

      expect(cache.set('gemini', 'some text', signature)).toBe(false);
      expect(cache.get('gemini', 'some text')).toBeUndefined();
    },
  );
});

describe('the moment a held signature stops counting', () => {
  test('a signature read on its expiry instant is gone', () => {
    let now = 0;
    const cache = new SignatureReplayCache(10, () => now);

    cache.set('gemini', 'some text', aSignature);
    now = 10;

    expect(cache.get('gemini', 'some text')).toBeUndefined();
  });

  test('a signature read one tick before its expiry still answers', () => {
    let now = 0;
    const cache = new SignatureReplayCache(10, () => now);

    cache.set('gemini', 'some text', aSignature);
    now = 9;

    expect(cache.get('gemini', 'some text')).toBe(aSignature);
  });

  test('clearing one model group leaves the others holding their signatures', () => {
    const cache = aCache();

    cache.set('gemini', 'some text', aSignature);
    cache.set('gemini-interactions', 'some text', aSignature);
    cache.clearModel('  gemini  ');

    expect(cache.get('gemini', 'some text')).toBeUndefined();
    expect(cache.get('gemini-interactions', 'some text')).toBe(aSignature);
  });
});
