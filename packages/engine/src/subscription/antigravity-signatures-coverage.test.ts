import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';
import type { GeminiSignatureDecision } from './antigravity-signatures';

import { sanitizeAntigravitySignatures } from './antigravity-signatures';

function nativeSignature(payload = Buffer.from([0x01, 0x0c, 0x39])): string {
  const inner = Buffer.concat([Buffer.from([0x0a, payload.length]), payload]);

  return Buffer.concat([Buffer.from([0x12, inner.length]), inner]).toString('base64');
}

function modelParts(...parts: unknown[]): JsonObject {
  return { contents: [{ role: 'model', parts }] };
}

function observed(request: JsonObject): GeminiSignatureDecision[] {
  const decisions: GeminiSignatureDecision[] = [];

  sanitizeAntigravitySignatures(request, 'gemini-3.5-flash', (decision) => {
    decisions.push(decision);
  });

  return decisions;
}

describe('reporting when a signature is replaced by the Gemini bypass', () => {
  test('a first call that arrives unsigned is reported as replaced', () => {
    const decisions = observed(modelParts({ functionCall: { name: 'first', args: {} } }));

    expect(decisions).toStrictEqual([
      {
        action: 'replace_with_gemini_bypass',
        blockKind: 'gemini_function_call',
        component: 'signature_sanitizer',
        contentIndex: 0,
        partIndex: 0,
        signatureLength: 0,
        targetProvider: 'gemini',
      },
    ]);
  });

  test('a first call carrying a native signature is left alone and unreported', () => {
    const request = modelParts({
      functionCall: { name: 'first', args: {} },
      thoughtSignature: nativeSignature(),
    });

    const decisions = observed(request);

    expect(decisions).toStrictEqual([]);
    expect(request).toHaveProperty('contents.0.parts.0.thoughtSignature', nativeSignature());
  });
});

describe('finding a signature Google tucked into extra content', () => {
  test('a Google-nested signature is lifted onto the first call', () => {
    const signature = nativeSignature();
    const request = modelParts({
      functionCall: { name: 'first', args: {} },
      extra_content: { google: { thought_signature: signature } },
    });

    sanitizeAntigravitySignatures(request, 'gemini-3.5-flash');

    expect(request).toHaveProperty('contents.0.parts.0.thoughtSignature', signature);
    expect(request).not.toHaveProperty('contents.0.parts.0.extra_content');
  });

  test('extra content holding no Google signature leaves the call unsigned', () => {
    const request = modelParts({
      functionCall: { name: 'first', args: {} },
      extra_content: { google: { note: 'nothing here' } },
    });

    sanitizeAntigravitySignatures(request, 'gemini-3.5-flash');

    expect(request).toHaveProperty(
      'contents.0.parts.0.thoughtSignature',
      'skip_thought_signature_validator',
    );
  });
});

describe('sanitizing a request whose shape is not what Gemini expects', () => {
  test('a request with no conversation is left untouched', () => {
    const request: JsonObject = { model: 'gemini-3.5-flash' };

    sanitizeAntigravitySignatures(request, 'gemini-3.5-flash');

    expect(request).toStrictEqual({ model: 'gemini-3.5-flash' });
  });

  test('entries that are not conversation turns survive sanitizing unchanged', () => {
    const request: JsonObject = {
      contents: ['not-a-turn', { role: 'model' }, { role: 'model', parts: ['not-a-part'] }],
    };

    sanitizeAntigravitySignatures(request, 'gemini-3.5-flash');

    expect(request).toStrictEqual({
      contents: ['not-a-turn', { role: 'model' }, { role: 'model', parts: ['not-a-part'] }],
    });
  });
});
