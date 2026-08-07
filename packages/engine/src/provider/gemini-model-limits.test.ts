import { describe, expect, test } from 'vitest';

import { cappedGeminiOutput } from './gemini-model-limits';

const registryModels = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-pro-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-3-pro-image-preview',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
];

describe('cappedGeminiOutput', () => {
  test.each(registryModels)('caps %s at its output-token limit', (model) => {
    const body = {
      generationConfig: { maxOutputTokens: 500_000, temperature: 0.2 },
      contents: [],
    };

    expect(cappedGeminiOutput(body, model)).toEqual({
      generationConfig: { maxOutputTokens: 65_536, temperature: 0.2 },
      contents: [],
    });
  });

  test.each([
    ['gemini-3.1-pro-preview', 64_000],
    ['custom-gemini-model', 500_000],
  ])('leaves an allowed or unknown limit unchanged for %s', (model, maxOutputTokens) => {
    const body = { generationConfig: { maxOutputTokens } };

    expect(cappedGeminiOutput(body, model)).toBe(body);
  });
});
