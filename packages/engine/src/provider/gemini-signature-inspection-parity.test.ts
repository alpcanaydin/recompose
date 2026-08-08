import { describe, expect, test } from 'vitest';

import {
  geminiReplaySignature,
  geminiTextSignature,
  nativeGeminiSignature,
} from './gemini-signature';
import {
  GEMINI_SKIP_THOUGHT_SIGNATURE_VALIDATOR,
  inspectGeminiThoughtSignature,
} from './gemini-signature-inspection';

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

describe('Gemini relaxed signature inspection', () => {
  test('TestInspectGeminiThoughtSignature_AcceptsOpaqueBase64', () => {
    const signature = base64(Uint8Array.of(0x45, 0x12));
    const info = inspectGeminiThoughtSignature(signature);

    expect(info).toMatchObject({ envelope: 'unknown', knownEnvelope: false, decodedLength: 2 });
    expect(geminiTextSignature(signature)).toBe(signature);
    expect(nativeGeminiSignature(signature)).toBeNull();
    expect(geminiReplaySignature(signature)).toBe(GEMINI_SKIP_THOUGHT_SIGNATURE_VALIDATOR);
  });

  test('TestInspectGeminiThoughtSignature_ClassifiesASCIIUUIDAsOpaque', () => {
    const signature = Buffer.from('e24830a7-5cd6-42fe-998b-ee539e72b9c3').toString('base64');

    expect(inspectGeminiThoughtSignature(signature)).toMatchObject({
      envelope: 'ascii_uuid',
      knownEnvelope: false,
      opaquePayloadLength: 36,
    });
    expect(inspectGeminiThoughtSignature(signature, { requireKnownEnvelope: true })).toBeNull();
  });
});

describe('Gemini signature inspection options', () => {
  test('TestInspectGeminiThoughtSignature_ObservedMarkerOption', () => {
    const signature = base64(Uint8Array.of(0x45, 0x12));

    expect(inspectGeminiThoughtSignature(signature)).not.toBeNull();
    expect(inspectGeminiThoughtSignature(signature, { requireObservedMarker: true })).toBeNull();
  });

  test('TestInspectGeminiThoughtSignature_BypassSentinelRequiresOption', () => {
    expect(inspectGeminiThoughtSignature(GEMINI_SKIP_THOUGHT_SIGNATURE_VALIDATOR)).toBeNull();
    expect(
      inspectGeminiThoughtSignature(GEMINI_SKIP_THOUGHT_SIGNATURE_VALIDATOR, {
        allowBypassSentinel: true,
      }),
    ).toMatchObject({
      bypassSentinel: GEMINI_SKIP_THOUGHT_SIGNATURE_VALIDATOR,
      isBypassSentinel: true,
    });
  });
});
