import { describe, expect, it } from 'vitest';

import { translateRequestToGemini } from './gemini-bridge';

describe('Interactions generation options crossing to Gemini', () => {
  it('should preserve thinking, modalities, JSON format, and service tier', () => {
    const translated = translateRequestToGemini('interactions', requestWithOptions());

    if ('refusal' in translated) throw new Error('Interactions options were refused');

    expect(translated.value).toMatchObject({
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      generationConfig: {
        maxOutputTokens: 32,
        temperature: 0.4,
        topP: 0.8,
        stopSequences: ['END'],
        thinkingConfig: {
          thinkingLevel: 'high',
          thinkingBudget: 1024,
          includeThoughts: true,
        },
        responseModalities: ['TEXT', 'IMAGE'],
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
      },
      service_tier: 'priority',
    });
  });

  it('should accept top-level tool-choice and reasoning aliases', () => {
    const translated = translateRequestToGemini('interactions', {
      input: 'hi',
      tools: [{ type: 'function', name: 'lookup' }],
      tool_choice: { type: 'function', function: { name: 'lookup' } },
      reasoning: { effort: 'medium', summary: 'auto' },
    });

    expect(translated).toHaveProperty(
      'value.toolConfig.functionCallingConfig.allowedFunctionNames.0',
      'lookup',
    );
    expect(translated).toHaveProperty('value.generationConfig.thinkingConfig', {
      thinkingLevel: 'medium',
      includeThoughts: true,
    });
  });

  it('should disable Gemini thought summaries when Interactions asks for none', () => {
    const translated = translateRequestToGemini('interactions', {
      input: 'hi',
      generation_config: { thinking_summaries: 'none' },
    });

    expect(translated).toHaveProperty(
      'value.generationConfig.thinkingConfig.includeThoughts',
      false,
    );
  });
});

// Helpers

function requestWithOptions() {
  return {
    model: 'gemini-3.5-flash',
    input: 'hi',
    generation_config: {
      max_output_tokens: 32,
      temperature: 0.4,
      top_p: 0.8,
      stop_sequences: ['END'],
      thinking_level: 'high',
      thinking_budget: 1024,
      thinking_summaries: 'auto',
    },
    response_modalities: ['text', 'image'],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'answer', schema: { type: 'object' } },
    },
    service_tier: 'priority',
  };
}
