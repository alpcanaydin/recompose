import { describe, expect, test } from 'vitest';

import {
  normalizeGeminiResponsesTextParts,
  normalizeGeminiResponsesTextResponse,
} from './gemini-responses-text-signatures';

const signature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
const media = { inlineData: { mimeType: 'image/png', data: 'iVBOR' } };

describe('placing a signature that no neighbouring part can hold', () => {
  test('a media part cannot hold a pending signature, so a carrier keeps it', () => {
    const parts = normalizeGeminiResponsesTextParts([{ thoughtSignature: signature }, media]);

    expect(parts[0]).toMatchObject({
      thought: true,
      thoughtSignature: signature,
      responsesSignatureDirection: 'next',
    });
    expect(parts[1]).toEqual(media);
  });

  test('a media part alone survives normalization untouched', () => {
    expect(normalizeGeminiResponsesTextParts([media])).toEqual([media]);
  });
});

describe('merging consecutive reasoning parts', () => {
  test('two unsigned reasoning parts without text merge into one empty thought', () => {
    expect(normalizeGeminiResponsesTextParts([{ thought: true }, { thought: true }])).toEqual([
      { thought: true, text: '' },
    ]);
  });

  test('two unsigned reasoning parts join their text', () => {
    expect(
      normalizeGeminiResponsesTextParts([
        { thought: true, text: 'first ' },
        { thought: true, text: 'second' },
      ]),
    ).toEqual([{ thought: true, text: 'first second' }]);
  });
});

describe('keeping a reasoning part that already holds its own signature', () => {
  test('a signed visible text does not steal the signature of a signed thought', () => {
    const parts = normalizeGeminiResponsesTextParts([
      { thought: true, text: 'weighing it', thoughtSignature: signature },
      { text: 'answer', thoughtSignature: signature },
    ]);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ thought: true, thoughtSignature: signature });
    expect(parts[1]).toMatchObject({ text: 'answer', thoughtSignature: signature });
  });
});

describe('normalizing a whole Gemini response', () => {
  test('a response with no candidate passes through untouched', () => {
    const response = { candidates: [] };

    expect(normalizeGeminiResponsesTextResponse(response)).toBe(response);
  });

  test('a candidate with no content passes through untouched', () => {
    const response = { candidates: [{ finishReason: 'STOP' }] };

    expect(normalizeGeminiResponsesTextResponse(response)).toBe(response);
  });

  test('a candidate with parts has its detached signature carried forward', () => {
    const normalized = normalizeGeminiResponsesTextResponse({
      candidates: [{ content: { role: 'model', parts: [{ thoughtSignature: signature }, media] } }],
    });

    expect(normalized.candidates?.[0]?.content?.parts[0]).toMatchObject({
      responsesSignatureDirection: 'next',
    });
  });
});
