import { describe, expect, it } from 'vitest';

import {
  compatibleGeminiCarrierSignature,
  decodeGeminiResponsesCarrier,
  encodeGeminiResponsesCarrier,
} from './gemini-responses-carrier';

const signature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';

describe('Gemini Responses signature carriers', () => {
  it.each([
    ['next', 'text'],
    ['previous', 'function'],
    ['standalone', 'any'],
  ] as const)('should round-trip %s/%s metadata', (direction, target) => {
    const encoded = encodeGeminiResponsesCarrier({ signature, direction, target });

    expect(decodeGeminiResponsesCarrier(encoded)).toEqual({
      marked: true,
      valid: true,
      signature,
      direction,
      target,
    });
  });

  it('should reject malformed and nested carriers', () => {
    const malformed = 'cpa-gemini-responses-carrier-v1:next:function:not-base64!';
    const nested = encodeGeminiResponsesCarrier({
      signature: encodeGeminiResponsesCarrier({ signature, direction: 'next', target: 'text' }),
      direction: 'previous',
      target: 'function',
    });

    expect(decodeGeminiResponsesCarrier(malformed)).toEqual({ marked: true, valid: false });
    expect(decodeGeminiResponsesCarrier(nested)).toEqual({ marked: true, valid: false });
  });

  it('should expose only compatible native signatures', () => {
    const carrier = encodeGeminiResponsesCarrier({
      signature,
      direction: 'next',
      target: 'function',
    });
    const bypass = encodeGeminiResponsesCarrier({
      signature: 'skip_thought_signature_validator',
      direction: 'next',
      target: 'function',
    });

    expect(compatibleGeminiCarrierSignature(carrier)).toBe(signature);
    expect(compatibleGeminiCarrierSignature(bypass)).toBeNull();
  });
});

describe('refusing carriers that hold no usable signature', () => {
  it('should encode a blank signature as no carrier at all', () => {
    expect(
      encodeGeminiResponsesCarrier({ signature: '  ', direction: 'next', target: 'text' }),
    ).toBe('');
  });

  it.each([
    ['a payload whose signature is not canonical base64url', 'next:text:QR'],
    ['a payload whose signature decodes to nothing', 'next:text:'],
    ['a payload naming an unknown direction', 'sideways:text:c2ln'],
    ['a payload naming an unknown target', 'next:sound:c2ln'],
  ])('should reject %s', (_label, payload) => {
    expect(decodeGeminiResponsesCarrier(`cpa-gemini-responses-carrier-v1:${payload}`)).toEqual({
      marked: true,
      valid: false,
    });
  });

  it('should read an unmarked value as the bare signature it is', () => {
    expect(decodeGeminiResponsesCarrier(` ${signature} `)).toEqual({
      marked: false,
      valid: true,
      signature,
    });
  });

  it('should expose no native signature for an unmarked value', () => {
    expect(compatibleGeminiCarrierSignature(signature)).toBeNull();
  });
});
