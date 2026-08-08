import { describe, expect, it } from 'vitest';

import { nativeSignature } from '../subscription/antigravity-replay.testkit';
import { geminiTextSignature, nativeGeminiSignature } from './gemini-signature';

describe('reading a Gemini thought signature off a prefixed value', () => {
  it('should read a signature carried under the google prefix', () => {
    const signature = nativeSignature();

    expect(nativeGeminiSignature(`google#${signature}`)).toBe(signature);
  });

  it('should refuse a signature carried under a foreign prefix', () => {
    const signature = nativeSignature();

    expect(nativeGeminiSignature(`openai#${signature}`)).toBeNull();
  });
});

describe('reading a Gemini text signature', () => {
  it('should refuse a signature that is not written as text', () => {
    expect(geminiTextSignature(42)).toBeNull();
  });

  it('should refuse a value no Gemini envelope explains', () => {
    expect(geminiTextSignature('not-a-signature')).toBeNull();
  });
});
