import { expect, test } from 'vitest';

import type { GeminiSignatureDecision } from './antigravity-signatures';

import { sanitizeAntigravitySignatures } from './antigravity-signatures';

test('TestSanitizeGeminiRequestThoughtSignaturesLogsBypassReplacement', () => {
  const signature = Buffer.from('e24830a7-5cd6-42fe-998b-ee539e72b9c3').toString('base64');
  const request = {
    contents: [
      {
        role: 'model',
        parts: [
          {
            functionCall: { name: 'f', args: {}, thoughtSignature: signature },
          },
        ],
      },
    ],
  };
  const decisions: GeminiSignatureDecision[] = [];

  sanitizeAntigravitySignatures(request, 'gemini-3-pro', (decision) => {
    decisions.push(decision);
  });

  expect(request).toHaveProperty(
    'contents.0.parts.0.thoughtSignature',
    'skip_thought_signature_validator',
  );
  expect(decisions).toContainEqual({
    action: 'replace_with_gemini_bypass',
    blockKind: 'gemini_function_call',
    component: 'signature_sanitizer',
    contentIndex: 0,
    partIndex: 0,
    signatureLength: signature.length,
    targetProvider: 'gemini',
  });
  expect(JSON.stringify(decisions)).not.toContain(signature);
});
