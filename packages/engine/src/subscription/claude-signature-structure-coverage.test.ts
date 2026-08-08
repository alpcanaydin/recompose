import { describe, expect, test } from 'vitest';

import {
  strictCaisClaudeSignature,
  strictClassicClaudeSignature,
} from './claude-signature-structure';

function varint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;

  while (remaining >= 0x80) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 0x80);
  }

  bytes.push(remaining);

  return bytes;
}

function tagged(number: number, wire: number): number[] {
  return varint(number * 8 + wire);
}

function varintField(number: number, value: number): number[] {
  return [...tagged(number, 0), ...varint(value)];
}

function bytesField(number: number, value: readonly number[]): number[] {
  return [...tagged(number, 2), ...varint(value.length), ...value];
}

function textField(number: number, value: string): number[] {
  return bytesField(number, [...Buffer.from(value, 'utf8')]);
}

function filler(width: number): number[] {
  return Array.from({ length: width }, () => 1);
}

function base64(bytes: readonly number[]): string {
  return Buffer.from(bytes).toString('base64');
}

function classicSignatureWith(trailing: readonly number[]): string {
  const channel = [...varintField(1, 12), ...varintField(2, 2)];

  return base64([...bytesField(2, bytesField(1, channel)), ...trailing]);
}

function caisChannel(extra: readonly number[]): number[] {
  return [
    ...varintField(1, 16),
    ...bytesField(5, filler(8)),
    ...textField(6, 'claude-opus-5'),
    ...extra,
  ];
}

function caisSignatureOf(container: readonly number[]): string {
  return base64([...varintField(1, 2), ...bytesField(2, container)]);
}

function caisSignatureWith(extra: readonly number[]): string {
  return caisSignatureOf(bytesField(1, caisChannel(extra)));
}

describe('classic Claude signature structure', () => {
  test('a signature carrying a complete fixed-width trailer stays recognized', () => {
    const sixtyFourBit = classicSignatureWith([...tagged(4, 1), ...filler(8)]);
    const thirtyTwoBit = classicSignatureWith([...tagged(4, 5), ...filler(4)]);

    expect(strictClassicClaudeSignature(sixtyFourBit)).toBe(sixtyFourBit);
    expect(strictClassicClaudeSignature(thirtyTwoBit)).toBe(thirtyTwoBit);
  });

  test('a signature whose trailing field runs past the payload is refused', () => {
    const truncated = [
      classicSignatureWith([...tagged(4, 1), ...filler(7)]),
      classicSignatureWith([...tagged(4, 5), ...filler(3)]),
      classicSignatureWith([...tagged(4, 0), 0xff]),
      classicSignatureWith([...tagged(4, 2), 0x40]),
      classicSignatureWith(tagged(4, 3)),
    ];

    for (const signature of truncated) {
      expect(strictClassicClaudeSignature(signature)).toBeNull();
    }
  });

  test('an E-prefixed payload that does not open with the classic container is refused', () => {
    const signature = base64([0x10, 0x01]);

    expect(signature.startsWith('E')).toBe(true);
    expect(strictClassicClaudeSignature(signature)).toBeNull();
  });

  test('a wrapped signature whose outer envelope is not base64 is refused', () => {
    expect(strictClassicClaudeSignature('R@#$')).toBeNull();
  });

  test('a wrapped signature carrying a classic payload is unwrapped and returned', () => {
    const inner = classicSignatureWith([]);
    const wrapped = base64([...Buffer.from(inner, 'utf8')]);

    expect(wrapped.startsWith('R')).toBe(true);
    expect(strictClassicClaudeSignature(wrapped)).toBe(inner);
  });

  test('a signature that belongs to neither envelope family is refused', () => {
    expect(strictClassicClaudeSignature('QUJD')).toBeNull();
  });
});

describe('CAIS Claude signature structure', () => {
  test('a well-formed CAIS channel is recognized', () => {
    const signature = caisSignatureWith([]);

    expect(signature.startsWith('C')).toBe(true);
    expect(strictCaisClaudeSignature(signature)).toBe(signature);
  });

  test('a CAIS channel carrying a canonical context identifier is recognized', () => {
    const signature = caisSignatureWith(textField(11, '1b4e28ba-2fa1-11d2-883f-0016d3cca427'));

    expect(strictCaisClaudeSignature(signature)).toBe(signature);
  });

  test('a CAIS channel whose context is not a canonical identifier is refused', () => {
    const numericContext = caisSignatureWith(varintField(11, 5));
    const invalidUtf8 = caisSignatureWith(bytesField(11, [0xff, 0xfe]));
    const plainText = caisSignatureWith(textField(11, 'not-a-uuid'));

    expect(strictCaisClaudeSignature(numericContext)).toBeNull();
    expect(strictCaisClaudeSignature(invalidUtf8)).toBeNull();
    expect(strictCaisClaudeSignature(plainText)).toBeNull();
  });

  test('a C-prefixed payload that does not open with the channel identifier is refused', () => {
    const signature = base64([0x09, ...filler(8)]);

    expect(signature.startsWith('C')).toBe(true);
    expect(strictCaisClaudeSignature(signature)).toBeNull();
  });

  test('a C-prefixed payload whose top-level fields are truncated is refused', () => {
    const signature = base64([0x08, 0xff]);

    expect(signature.startsWith('C')).toBe(true);
    expect(strictCaisClaudeSignature(signature)).toBeNull();
  });

  test('a CAIS container that holds no channel is refused', () => {
    const signature = caisSignatureOf(bytesField(3, caisChannel([])));

    expect(strictCaisClaudeSignature(signature)).toBeNull();
  });

  test('a C-prefixed signature that is not base64 is refused', () => {
    expect(strictCaisClaudeSignature('C@#$')).toBeNull();
  });

  test('a signature outside the CAIS envelope is refused', () => {
    expect(strictCaisClaudeSignature('QUJD')).toBeNull();
  });
});
