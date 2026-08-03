import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import {
  keyCheckReportSchema,
  keyCheckVerdictSchema,
  keyProviderIdSchema,
  keyTail,
  pastedKeySchema,
  vendorShapeOf,
} from './api-keys';

const keyBody = fc.stringMatching(/^[A-Za-z0-9_-]{1,40}$/);

const surroundingWhitespace = fc.string({
  unit: fc.constantFrom(' ', '\t', '\n', '\r'),
  maxLength: 4,
});

const controlCodePoints = [0, 7, 27, 127, 155];

describe('the providers a stored key can name', () => {
  test('exactly the two providers a probe knows how to ask', () => {
    expect(keyProviderIdSchema.options).toEqual(['anthropic', 'openai']);
  });

  test('a provider no probe speaks to is refused', () => {
    expect(() => keyProviderIdSchema.parse('gemini')).toThrow();
  });
});

describe('the key a person pastes into the form', () => {
  test('a key pasted with a trailing newline parses to its trim', () => {
    expect(pastedKeySchema.parse('sk-ant-api03-9f2c\n')).toBe('sk-ant-api03-9f2c');
  });

  test('a key pasted with surrounding spaces parses to its trim', () => {
    expect(pastedKeySchema.parse('   sk-proj-4d1e   ')).toBe('sk-proj-4d1e');
  });

  test('a key of nothing but whitespace is refused, because a blank key reaches nothing', () => {
    expect(() => pastedKeySchema.parse('   \n  ')).toThrow();
  });

  test('a key holding an interior control character is refused for what it holds', () => {
    for (const codePoint of controlCodePoints) {
      expect(() =>
        pastedKeySchema.parse(`sk-ant-api03${String.fromCodePoint(codePoint)}9f2c`),
      ).toThrow(/holds a control character/);
    }
  });

  test('a key broken across two lines is refused, because the break stands inside the key', () => {
    expect(() => pastedKeySchema.parse('sk-ant-api03\n9f2c')).toThrow(/holds a control character/);
  });

  test('a key shaped like another vendor is admitted, because a shape refusal turns away real keys', () => {
    expect(pastedKeySchema.parse('sk-ant-api03-9f2c')).toBe('sk-ant-api03-9f2c');
    expect(pastedKeySchema.parse('nothing-that-looks-like-a-key')).toBe(
      'nothing-that-looks-like-a-key',
    );
  });

  test.prop([surroundingWhitespace, keyBody, surroundingWhitespace])(
    'however a paste pads the key, what parses is the trim',
    (before, body, after) => {
      expect(pastedKeySchema.parse(`${before}${body}${after}`)).toBe(body);
    },
  );
});

describe('the tail a row publishes in place of the key', () => {
  test('the tail holds the last four characters of the trimmed key', () => {
    expect(keyTail('sk-ant-api03-9f2c\n')).toBe('9f2c');
  });

  test('a key of eight characters or fewer publishes nothing at all', () => {
    expect(keyTail('sk-12345')).toBeUndefined();
  });

  test('a ninth character is where a tail starts standing', () => {
    expect(keyTail('sk-123456')).toBe('3456');
  });

  test.prop([fc.string({ maxLength: 8 })])(
    'a short key never publishes half of itself',
    (pasted) => {
      expect(keyTail(pasted)).toBeUndefined();
    },
  );

  test.prop([surroundingWhitespace, fc.stringMatching(/^[A-Za-z0-9_-]{9,40}$/)])(
    'the tail is the trimmed key last four characters and never more',
    (padding, body) => {
      const tail = keyTail(`${padding}${body}${padding}`);

      expect(tail).toBe(body.slice(-4));
      expect(tail).toHaveLength(4);
    },
  );
});

describe('the hint a form draws when a key looks like another vendor', () => {
  test('the one documented family is the Anthropic opening', () => {
    expect(vendorShapeOf('sk-ant-api03-9f2c')).toBe('anthropic');
  });

  test('the hint reads the trim, so a padded paste still draws it', () => {
    expect(vendorShapeOf('  sk-ant-api03-9f2c\n')).toBe('anthropic');
  });

  test('an OpenAI key draws no hint, because that vendor documents no stable opening', () => {
    expect(vendorShapeOf('sk-proj-4d1e')).toBeUndefined();
  });

  test.prop([keyBody])('a key outside the one documented family stays unremarked', (body) => {
    fc.pre(!body.startsWith('sk-ant-'));

    expect(vendorShapeOf(body)).toBeUndefined();
  });
});

describe('the answer a key check carries back', () => {
  test('a check answers one of three verdicts and never a fourth', () => {
    expect(keyCheckVerdictSchema.options).toEqual([
      'authenticates',
      'not-accepted',
      'could-not-check',
    ]);
    expect(() => keyCheckVerdictSchema.parse('rate-limited')).toThrow();
  });

  test('an accepted key answers with the status the vendor gave', () => {
    const report = { verdict: 'authenticates', status: 200 };

    expect(keyCheckReportSchema.parse(report)).toEqual(report);
  });

  test('a check that never reached the vendor answers without a status', () => {
    const report = { verdict: 'could-not-check' };

    expect(keyCheckReportSchema.parse(report)).toEqual(report);
  });

  test('no upstream sentence can ride the answer back', () => {
    for (const smuggled of [{ body: 'invalid x-api-key' }, { message: 'incorrect api key' }]) {
      expect(() =>
        keyCheckReportSchema.parse({ verdict: 'not-accepted', status: 401, ...smuggled }),
      ).toThrow();
    }
  });

  test('the key itself has no field to ride back in', () => {
    expect(() =>
      keyCheckReportSchema.parse({ verdict: 'authenticates', key: 'sk-ant-api03-9f2c' }),
    ).toThrow();
  });

  test('a status that is not a whole number is refused', () => {
    expect(() => keyCheckReportSchema.parse({ verdict: 'authenticates', status: 200.5 })).toThrow();
  });
});
