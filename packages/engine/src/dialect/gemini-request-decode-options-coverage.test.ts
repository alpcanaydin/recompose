import { describe, expect, test } from 'vitest';

import type { GeminiRequest } from './gemini-wire';

import { geminiRequestOptions } from './gemini-request-decode-options';

function requestWith(fields: Partial<GeminiRequest>): GeminiRequest {
  return { contents: [], ...fields };
}

describe('Gemini tool choice decoding', () => {
  test('an automatic tool configuration lets the model decide', () => {
    const options = geminiRequestOptions(
      requestWith({ toolConfig: { functionCallingConfig: { mode: 'AUTO' } } }),
    );

    expect(options.toolChoice).toEqual({ type: 'auto' });
  });

  test('a suppressed tool configuration forbids tool calls', () => {
    const options = geminiRequestOptions(
      requestWith({ toolConfig: { functionCallingConfig: { mode: 'NONE' } } }),
    );

    expect(options.toolChoice).toEqual({ type: 'none' });
  });

  test('a forced configuration naming one function pins that tool', () => {
    const options = geminiRequestOptions(
      requestWith({
        toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['lookup'] } },
      }),
    );

    expect(options.toolChoice).toEqual({ type: 'tool', name: 'lookup' });
  });

  test('a forced configuration without a single named function demands any tool', () => {
    const unnamed = geminiRequestOptions(
      requestWith({ toolConfig: { functionCallingConfig: { mode: 'ANY' } } }),
    );
    const several = geminiRequestOptions(
      requestWith({
        toolConfig: {
          functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['lookup', 'search'] },
        },
      }),
    );

    expect(unnamed.toolChoice).toEqual({ type: 'required' });
    expect(several.toolChoice).toEqual({ type: 'required' });
  });

  test('a request without a tool configuration states no tool choice', () => {
    expect(geminiRequestOptions(requestWith({}))).not.toHaveProperty('toolChoice');
  });
});

describe('Gemini sampling decoding', () => {
  test('a generation config holding no sampling controls states no sampling', () => {
    const options = geminiRequestOptions(requestWith({ generationConfig: { seed: 7 } }));

    expect(options).not.toHaveProperty('sampling');
  });

  test('a token ceiling travels alone when no other control is set', () => {
    const options = geminiRequestOptions(
      requestWith({ generationConfig: { maxOutputTokens: 128 } }),
    );

    expect(options.sampling).toEqual({ maxOutputTokens: 128 });
  });

  test('temperature, nucleus sampling and stop sequences travel together', () => {
    const options = geminiRequestOptions(
      requestWith({ generationConfig: { temperature: 0.2, topP: 0.5, stopSequences: ['END'] } }),
    );

    expect(options.sampling).toEqual({ temperature: 0.2, topP: 0.5, stop: ['END'] });
  });
});

describe('Gemini reasoning decoding', () => {
  test('a thinking config reports its level, budget and requested summary', () => {
    const options = geminiRequestOptions(
      requestWith({
        generationConfig: {
          thinkingConfig: { thinkingLevel: 'high', thinkingBudget: 2048, includeThoughts: true },
        },
      }),
    );

    expect(options.reasoning).toEqual({ effort: 'high', budgetTokens: 2048, summary: 'auto' });
  });

  test('a thinking config that hides thoughts asks for no summary', () => {
    const options = geminiRequestOptions(
      requestWith({ generationConfig: { thinkingConfig: { includeThoughts: false } } }),
    );

    expect(options.reasoning).toEqual({ summary: 'none' });
  });

  test('a request without a generation config states no reasoning', () => {
    expect(geminiRequestOptions(requestWith({}))).not.toHaveProperty('reasoning');
  });
});

describe('Gemini system instruction decoding', () => {
  test('the system instruction joins its text parts and drops the rest', () => {
    const options = geminiRequestOptions(
      requestWith({
        systemInstruction: {
          parts: [
            { text: 'first' },
            { inlineData: { mimeType: 'image/png', data: 'AAAA' } },
            { text: 'second' },
          ],
        },
      }),
    );

    expect(options.system).toEqual([{ text: 'first\nsecond' }]);
  });

  test('a system instruction whose parts carry no text states no system prompt', () => {
    const options = geminiRequestOptions(
      requestWith({ systemInstruction: { parts: [{ thought: true }] } }),
    );

    expect(options).not.toHaveProperty('system');
  });
});
