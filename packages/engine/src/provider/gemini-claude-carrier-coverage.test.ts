import { fc } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import type { GeminiClaudeCarrier } from './gemini-claude-carrier';

import { decodeGeminiClaudeCarrier, encodeGeminiClaudeCarrier } from './gemini-claude-carrier';

const PREFIX = 'cpa-gemini-carrier-v1:';

function carrierText(direction: string, target: string, encoded: string): string {
  return `${PREFIX}${direction}:${target}:${encoded}`;
}

function unpadded(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').replace(/=+$/u, '');
}

describe('Gemini carrier round trip', () => {
  test('an encoded carrier decodes back to the same signature, direction and target', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 33, max: 126 }), { minLength: 1, maxLength: 24 }),
        fc.constantFrom('next', 'previous', 'standalone'),
        fc.constantFrom('text', 'function', 'any'),
        (codes, direction, target) => {
          const signature = String.fromCodePoint(...codes);
          const carrier: GeminiClaudeCarrier = { signature, direction, target };

          expect(decodeGeminiClaudeCarrier(encodeGeminiClaudeCarrier(carrier))).toEqual(carrier);
        },
      ),
    );
  });

  test('a carrier with a blank signature encodes to nothing', () => {
    const encoded = encodeGeminiClaudeCarrier({
      signature: '   ',
      direction: 'next',
      target: 'text',
    });

    expect(encoded).toBe('');
  });
});

describe('Gemini carrier refusals', () => {
  test('a value that is not a carrier string carries no signature', () => {
    expect(decodeGeminiClaudeCarrier(42)).toBeNull();
    expect(decodeGeminiClaudeCarrier('plain-signature')).toBeNull();
  });

  test('a carrier naming an unknown direction or target is refused', () => {
    expect(decodeGeminiClaudeCarrier(carrierText('sideways', 'text', unpadded('sig')))).toBeNull();
    expect(decodeGeminiClaudeCarrier(carrierText('next', 'picture', unpadded('sig')))).toBeNull();
  });

  test('a carrier that stops before its payload is refused', () => {
    expect(decodeGeminiClaudeCarrier(`${PREFIX}next:text`)).toBeNull();
  });

  test('a carrier whose payload is not standard base64 is refused', () => {
    expect(decodeGeminiClaudeCarrier(carrierText('next', 'text', 'not base64!'))).toBeNull();
  });

  test('a carrier whose payload decodes to nothing is refused', () => {
    expect(decodeGeminiClaudeCarrier(carrierText('next', 'text', 'A'))).toBeNull();
  });

  test('a carrier wrapping another carrier is refused', () => {
    const nested = unpadded(carrierText('next', 'text', unpadded('sig')));

    expect(decodeGeminiClaudeCarrier(carrierText('previous', 'any', nested))).toBeNull();
  });
});
