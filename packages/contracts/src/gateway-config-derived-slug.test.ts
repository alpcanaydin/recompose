import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { gatewaySlugSchema, slugFromName } from './gateway-config';

const RESERVED_NAME_REFUSAL = 'Windows reserves this name';

function whyTheContractRefuses(slug: string): string[] {
  return gatewaySlugSchema.safeParse(slug).error?.issues.map((issue) => issue.message) ?? [];
}

describe('the slug a gateway derives from the name a person gave it', () => {
  test('a plain name lowercases into a slug', () => {
    expect(slugFromName('Codex')).toBe('codex');
  });

  test('the gaps between words become single dashes', () => {
    expect(slugFromName('My Gateway')).toBe('my-gateway');
    expect(slugFromName('Claude, Code & Friends')).toBe('claude-code-friends');
  });

  test('neither end of a slug carries a dash', () => {
    expect(slugFromName('  --Anthropic--  ')).toBe('anthropic');
  });

  test('an accented name folds to the letters underneath it', () => {
    expect(slugFromName('Café Noir')).toBe('cafe-noir');
  });

  test('a Turkish name folds its dotless i to an i', () => {
    expect(slugFromName('Kapı')).toBe('kapi');
  });

  test('a name whose letters no slug can carry falls back to gateway', () => {
    expect(slugFromName('网关')).toBe('gateway');
    expect(slugFromName('!!!')).toBe('gateway');
    expect(slugFromName('')).toBe('gateway');
  });

  test('a name longer than a hostname label allows stops at the bound', () => {
    expect(slugFromName('A'.repeat(100))).toBe('a'.repeat(63));
  });

  test('a name the bound cuts between words still ends on a letter', () => {
    expect(slugFromName(`${'a'.repeat(62)} bravo`)).toBe('a'.repeat(62));
  });

  test('a name Windows keeps for a device derives it anyway, for the sheet to refuse', () => {
    expect(slugFromName('Con')).toBe('con');
  });
});

const anyName = fc.oneof(
  fc.string(),
  fc.string({ unit: 'grapheme' }),
  fc.string({ unit: 'binary' }),
);

describe('the derivation answers every name a person can type', () => {
  test.prop([anyName])(
    'every name derives a slug the gateway contract accepts, or one only Windows refuses',
    (name) => {
      const refusals = whyTheContractRefuses(slugFromName(name));

      expect(refusals.filter((refusal) => refusal !== RESERVED_NAME_REFUSAL)).toEqual([]);
    },
  );

  test.prop([anyName])('deriving a slug from a derived slug changes nothing', (name) => {
    const derived = slugFromName(name);

    expect(slugFromName(derived)).toBe(derived);
  });
});
