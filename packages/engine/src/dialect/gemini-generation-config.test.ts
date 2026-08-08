import { describe, expect, it } from 'vitest';

import { ingressPayload, isJsonObject } from '../gateway-wire';
import { parsePreciseJson } from '../json-precise';
import { translateRequestToGemini } from './gemini-bridge';

describe('Interactions advanced Gemini generation config', () => {
  it('should camelize provider fields without losing nested configuration', () => {
    const translated = translateRequestToGemini('interactions', {
      model: 'gemini-3.5-flash',
      input: 'hi',
      generation_config: {
        max_output_tokens: 32,
        response_schema: { type: 'object' },
        seed: 42,
        thinking_config: { thinking_budget: 1024, include_thoughts: true },
        context_window_compression: { trigger_tokens: 1000 },
      },
    });

    expect(translated).toHaveProperty('value.generationConfig', {
      maxOutputTokens: 32,
      responseSchema: { type: 'object' },
      seed: 42,
      thinkingConfig: { thinkingBudget: 1024, includeThoughts: true },
      contextWindowCompression: { triggerTokens: 1000 },
    });
  });

  it('should camelize the fields nested inside a list value', () => {
    const translated = translateRequestToGemini('interactions', {
      model: 'gemini-3.5-flash',
      input: 'hi',
      generation_config: { speech_config: [{ voice_name: 'aoede' }] },
    });

    expect(translated).toHaveProperty('value.generationConfig.speechConfig', [
      { voiceName: 'aoede' },
    ]);
  });
});

describe('Gemini generation config a request states as a non-object', () => {
  it('should leave the provider configuration untouched', () => {
    const request = ingressPayload('chat-completions', {
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: 'hi' }],
      generationConfig: ['not-a-configuration'],
    });

    if (request === null) throw new Error('the Chat Completions request failed validation');

    const translated = translateRequestToGemini('chat-completions', request);

    expect(translated).not.toHaveProperty('value.generationConfig.0');
  });
});

describe('Interactions opaque Gemini generation config', () => {
  it('should preserve an opaque large identity value without numeric coercion', () => {
    const parsed = parsePreciseJson(
      '{"model":"gemini-3.5-flash","input":"hi","generation_config":{"large_identity":9223372036854775807}}',
    );

    if (!isJsonObject(parsed)) throw new Error('request failed to parse');

    const request = ingressPayload('interactions', parsed);

    if (request === null) throw new Error('Interactions request failed validation');

    const translated = translateRequestToGemini('interactions', request);

    expect(JSON.stringify(translated)).toContain('"largeIdentity":9223372036854775807');
  });
});
