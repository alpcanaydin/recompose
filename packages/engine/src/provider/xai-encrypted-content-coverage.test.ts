import { describe, expect, test } from 'vitest';

import {
  byteEntropyRatio,
  inspectGrokEncryptedContent,
  validGrokEncryptedContent,
} from './xai-encrypted-content';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function nativeSample(length: number, seed = 0): string {
  const bytes = Buffer.alloc(length);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * 41 + seed * 67 + 17) % 251;
  }

  return bytes.toString('base64').replace(/=+$/u, '');
}

function withStrayTrailingBits(sample: string): string {
  const last = sample.slice(-1);
  const index = BASE64_ALPHABET.indexOf(last);

  return `${sample.slice(0, -1)}${BASE64_ALPHABET.charAt((index & ~3) | 1)}`;
}

function geminiEnvelope(): string {
  const payload = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
  const container = Buffer.concat([Buffer.from([0x0a, payload.length]), payload]);

  return Buffer.concat([Buffer.from([0x12, container.length]), container]).toString('base64');
}

function codexEnvelope(): string {
  const bytes = Buffer.alloc(73);

  bytes[0] = 0x80;

  for (let index = 4; index < bytes.length; index += 1) {
    bytes[index] = (index * 53 + 29) % 251;
  }

  return bytes.toString('base64url').replace(/=+$/u, '');
}

describe('a value that is not readable ciphertext at all', () => {
  test('a value that is not a string carries no encrypted content', () => {
    expect(validGrokEncryptedContent(undefined)).toBe(false);
    expect(validGrokEncryptedContent(42)).toBe(false);
  });

  test('an empty string carries no encrypted content', () => {
    expect(validGrokEncryptedContent('')).toBe(false);
  });

  test('text that is not base64 at all is refused', () => {
    expect(inspectGrokEncryptedContent('this is plainly not base64')).toBeNull();
  });

  test('base64 whose trailing bits are stray is refused as non-canonical', () => {
    const sample = nativeSample(32);

    expect(validGrokEncryptedContent(sample)).toBe(true);
    expect(validGrokEncryptedContent(withStrayTrailingBits(sample))).toBe(false);
  });
});

describe('ciphertext must be transport safe', () => {
  test('surrounding whitespace disqualifies the value', () => {
    expect(validGrokEncryptedContent(` ${nativeSample(64)} `)).toBe(false);
  });

  test('base64 padding disqualifies the value', () => {
    expect(validGrokEncryptedContent(`${nativeSample(64)}=`)).toBe(false);
  });
});

describe('another provider envelope is never replayed as xAI ciphertext', () => {
  test('a native Gemini thought signature is refused', () => {
    expect(validGrokEncryptedContent(geminiEnvelope())).toBe(false);
  });

  test('a Codex reasoning signature is refused', () => {
    expect(validGrokEncryptedContent(codexEnvelope())).toBe(false);
  });
});

describe('byte entropy of a payload', () => {
  test('an empty payload has no entropy to measure', () => {
    expect(byteEntropyRatio(new Uint8Array())).toBe(0);
  });

  test('a payload wider than the byte alphabet is measured against the alphabet', () => {
    const wide = Buffer.alloc(512);

    for (let index = 0; index < wide.length; index += 1) wide[index] = index % 256;

    expect(byteEntropyRatio(wide)).toBeCloseTo(1, 5);
  });

  test('a payload of a single repeated byte has no entropy', () => {
    expect(byteEntropyRatio(Buffer.alloc(64, 0x11))).toBe(0);
  });
});
