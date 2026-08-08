import { describe, expect, test } from 'vitest';

import {
  byteEntropyRatio,
  inspectGrokEncryptedContent,
  MAX_GROK_ENCRYPTED_CONTENT_LENGTH,
  MIN_GROK_ENCRYPTED_CONTENT_DECODED_LENGTH,
  MIN_GROK_ENCRYPTED_CONTENT_ENTROPY_RATIO,
  validGrokEncryptedContent,
} from './xai-encrypted-content';

function nativeSample(length: number, seed = 0): string {
  const bytes = Buffer.alloc(length);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * 41 + seed * 67 + 17) % 251;
  }

  return bytes.toString('base64').replace(/=+$/u, '');
}

function field(number: number, value: Uint8Array): Buffer {
  return Buffer.concat([Buffer.from([number * 8 + 2, value.length]), value]);
}

function caisSample(): string {
  const channel = Buffer.concat([
    Buffer.from([0x08, 0x10]),
    field(5, Buffer.from(Array.from({ length: 65 }, (_value, index) => (index * 37 + 11) % 251))),
    field(6, Buffer.from('claude-opus-5')),
  ]);
  const payload = Buffer.concat([Buffer.from([0x08, 0x02]), field(2, field(1, channel))]);

  return payload.toString('base64').replace(/=+$/u, '');
}

describe('xAI native encrypted-content validation', () => {
  test('TestInspectGrokEncryptedContent_NativeSamples', () => {
    for (const [index, length] of [50, 63, 128, 256, 1024].entries()) {
      const sample = nativeSample(length, index);

      expect(inspectGrokEncryptedContent(sample)).toEqual({
        rawLength: sample.length,
        decodedLength: length,
      });
    }
  });

  test('TestInspectGrokEncryptedContent_ThresholdMargins', () => {
    expect(MIN_GROK_ENCRYPTED_CONTENT_DECODED_LENGTH).toBeLessThan(50);
    expect(MIN_GROK_ENCRYPTED_CONTENT_ENTROPY_RATIO).toBeLessThan(0.892);
    expect(validGrokEncryptedContent(nativeSample(32))).toBe(true);
    expect(validGrokEncryptedContent(nativeSample(31))).toBe(false);
    expect(validGrokEncryptedContent('A'.repeat(MAX_GROK_ENCRYPTED_CONTENT_LENGTH + 1))).toBe(
      false,
    );
  });
});

describe('xAI foreign envelope rejection', () => {
  test('TestInspectGrokEncryptedContent_RejectsClaudeCAISSignature', () => {
    expect(validGrokEncryptedContent(caisSample())).toBe(false);
  });

  test('TestInspectGrokEncryptedContent_RejectsProviderCachePrefix', () => {
    const sample = nativeSample(64);

    for (const prefix of ['claude#', 'anthropic#', 'gemini#', 'openai#', 'codex#']) {
      expect(validGrokEncryptedContent(`${prefix}${sample}`)).toBe(false);
    }
  });
});

describe('xAI ciphertext entropy safety', () => {
  test('TestInspectGrokEncryptedContent_RejectsLowEntropyPayload', () => {
    const repeated = Buffer.alloc(32, 0xa5).toString('base64').replace(/=+$/u, '');

    expect(validGrokEncryptedContent(repeated)).toBe(false);
  });

  test('TestByteEntropyRatio_SingleByteReturnsZero', () => {
    expect(byteEntropyRatio(Uint8Array.of(0xa5))).toBe(0);
  });
});
