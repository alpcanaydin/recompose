import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { modelAliasFromName, modelAliasSchema } from './gateway-config';

describe('the id a name derives for a client to send as its model', () => {
  test('a name that already reads as an id keeps the dots real model names carry', () => {
    expect(modelAliasFromName('claude-5.6-sol')).toBe('claude-5.6-sol');
  });

  test('the gaps between words become single dashes and the case folds down', () => {
    expect(modelAliasFromName('GPT 5.6 Sol')).toBe('gpt-5.6-sol');
  });

  test('punctuation no id can carry falls away rather than staying', () => {
    expect(modelAliasFromName('my model!!')).toBe('my-model');
  });

  test('a name with nothing an id can carry derives nothing', () => {
    expect(modelAliasFromName('')).toBe('');
    expect(modelAliasFromName('   ')).toBe('');
  });
});

describe('the id charset a stored virtual model accepts', () => {
  test('an id carrying the dots real model names use is accepted', () => {
    for (const id of ['claude-5.6-sol', 'gpt-5.6', 'claude-3.5-sonnet', 'llama3.2']) {
      expect(modelAliasSchema.safeParse(id).success).toBe(true);
    }
  });

  test('an id that already reads dash-only stays accepted, so nothing stored needs migrating', () => {
    for (const id of ['fast', 'fast-sonnet']) {
      expect(modelAliasSchema.safeParse(id).success).toBe(true);
    }
  });

  test('a space, an uppercase letter, or a separator on either end is refused', () => {
    for (const id of ['fast sonnet', 'Fast', '.fast', 'fast.', '-fast', 'fast-', '']) {
      expect(modelAliasSchema.safeParse(id).success).toBe(false);
    }
  });
});

const anyName = fc.oneof(
  fc.string(),
  fc.string({ unit: 'grapheme' }),
  fc.string({ unit: 'binary' }),
);

describe('the derivation answers every name a person can type', () => {
  test.prop([anyName])('every derived id is empty or one the stored shape accepts', (name) => {
    const derived = modelAliasFromName(name);

    expect(derived === '' || modelAliasSchema.safeParse(derived).success).toBe(true);
  });

  test.prop([anyName])('deriving an id from a derived id changes nothing', (name) => {
    const derived = modelAliasFromName(name);

    expect(modelAliasFromName(derived)).toBe(derived);
  });
});
