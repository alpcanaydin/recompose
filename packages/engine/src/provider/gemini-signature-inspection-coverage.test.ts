import { describe, expect, it } from 'vitest';

import { inspectGeminiThoughtSignature } from './gemini-signature-inspection';

describe('inspectGeminiThoughtSignature: a value that carries no signature', () => {
  it('reads nothing from a field the vendor did not send as text', () => {
    expect(inspectGeminiThoughtSignature(42)).toBeNull();
  });

  it('reads nothing from a prefixed value that is not base64 at all', () => {
    expect(inspectGeminiThoughtSignature('gemini#not base64')).toBeNull();
  });
});

describe('inspectGeminiThoughtSignature: a truncated protobuf envelope', () => {
  it('reports the observed marker but leaves the envelope unknown', () => {
    expect(inspectGeminiThoughtSignature('Eg==')).toEqual({
      decodedLength: 1,
      envelope: 'unknown',
      firstByte: 0x12,
      hasObservedMarker: true,
      isBypassSentinel: false,
      knownEnvelope: false,
      opaquePayloadLength: 1,
      recordCount: 0,
    });
  });
});
