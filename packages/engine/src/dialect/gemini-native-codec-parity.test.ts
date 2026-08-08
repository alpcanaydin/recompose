import { describe, expect, it } from 'vitest';

import type { GeminiResponse } from './gemini-wire';
import type { InteractionsStreamEvent } from './interactions-wire';

import { translateRequest, translateResponse, translateStream } from './dispatcher';

describe('native Gemini requests crossing Interactions', () => {
  it('should map system text and generation config', () => {
    const translated = translateRequest('gemini', 'interactions', {
      systemInstruction: { parts: [{ text: 'be brief' }, { text: 'answer directly' }] },
      generationConfig: {
        maxOutputTokens: 32,
        topP: 0.8,
        thinkingConfig: { thinkingBudget: 1024 },
      },
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    });

    expect(translated).toHaveProperty('value.system_instruction', 'be brief\nanswer directly');
    expect(translated).toHaveProperty('value.generation_config.max_output_tokens', 32);
    expect(translated).toHaveProperty('value.generation_config.top_p', 0.8);
    expect(translated).toHaveProperty('value.generation_config.thinking_budget', 1024);
  });

  it.each([
    { field: 'id', value: 'call_id_1' },
    { field: 'call_id', value: 'call_alias_1' },
  ])('should preserve function call identity from $field', ({ field, value }) => {
    const call = { name: 'lookup', args: { q: 'x' }, [field]: value };
    const result = { name: 'lookup', response: { ok: true }, [field]: value };
    const translated = translateRequest('gemini', 'interactions', {
      contents: [
        { role: 'model', parts: [{ functionCall: call }] },
        { role: 'user', parts: [{ functionResponse: result }] },
      ],
    });

    expect(translated).toHaveProperty('value.input.0.call_id', value);
    expect(translated).toHaveProperty('value.input.1.call_id', value);
  });
});

describe('native Gemini multimodal requests crossing Interactions', () => {
  it('should preserve text, thought, and multimodal parts', () => {
    const translated = translateRequest('gemini', 'interactions', {
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'hi' },
            { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } },
            { fileData: { mimeType: 'application/pdf', fileUri: 'gs://bucket/doc.pdf' } },
          ],
        },
        { role: 'model', parts: [{ text: 'thinking', thought: true }] },
      ],
    });

    expect(translated).toHaveProperty('value.input.0.content.0', { type: 'text', text: 'hi' });
    expect(translated).toHaveProperty('value.input.0.content.1.type', 'image');
    expect(translated).toHaveProperty('value.input.0.content.2.type', 'file');
    expect(translated).toHaveProperty('value.input.1.type', 'thought');
  });
});

describe('Interactions answers crossing native Gemini', () => {
  it('should encode a non-stream function call with identity and arguments', () => {
    const translated = translateResponse('interactions', 'gemini', {
      id: 'i1',
      model: 'gemini-3.5-flash',
      status: 'requires_action',
      steps: [
        {
          type: 'function_call',
          id: 'call_1',
          name: 'get_weather',
          arguments: { location: '北京' },
        },
      ],
      usage: { total_input_tokens: 2, total_output_tokens: 3, total_tokens: 5 },
    });

    if ('outcome' in translated || 'refusal' in translated) {
      throw new Error('expected translated response');
    }

    expect(translated.value).toHaveProperty('candidates.0.content.parts.0.functionCall', {
      id: 'call_1',
      name: 'get_weather',
      args: { location: '北京' },
    });
  });
});

describe('Interactions function-call streams crossing native Gemini', () => {
  it('should emit a streamed function call after its arguments close', async () => {
    const source: readonly InteractionsStreamEvent[] = [
      {
        event_type: 'step.start',
        index: 0,
        step: {
          type: 'function_call',
          id: 'call_1',
          name: 'get_weather',
          arguments: {},
          signature: 'sig_1',
        },
      },
      {
        event_type: 'step.delta',
        index: 0,
        delta: { type: 'arguments_delta', arguments: '{"location":"北京"}' },
      },
      { event_type: 'step.stop', index: 0 },
      {
        event_type: 'interaction.completed',
        interaction: { id: 'i1', status: 'requires_action' },
      },
    ];

    const chunks = await translatedGeminiStream(source);
    const call = chunks.find(hasFunctionCall);

    expect(call).toHaveProperty('candidates.0.content.parts.0', {
      functionCall: {
        id: 'call_1',
        name: 'get_weather',
        args: { location: '北京' },
      },
      thoughtSignature: 'sig_1',
    });
  });
});

describe('Interactions finish metadata crossing native Gemini', () => {
  it('should encode finish metadata usage', async () => {
    const chunks = await translatedGeminiStream([
      {
        event_type: 'finish',
        metadata: {
          total_usage: {
            total_input_tokens: 2,
            total_output_tokens: 6,
            total_cached_tokens: 1,
            total_thought_tokens: 3,
            total_tokens: 8,
          },
        },
      },
    ]);

    expect(chunks.at(-1)?.usageMetadata).toMatchObject({
      promptTokenCount: 2,
      candidatesTokenCount: 6,
      cachedContentTokenCount: 1,
      thoughtsTokenCount: 3,
      totalTokenCount: 11,
    });
  });
});

async function translatedGeminiStream(source: readonly InteractionsStreamEvent[]) {
  const translated = translateStream('interactions', 'gemini', streamOf(source));

  if ('outcome' in translated) throw new Error('expected translated stream');

  const chunks = [];

  for await (const chunk of translated.stream) chunks.push(chunk);

  return chunks;
}

function hasFunctionCall(chunk: GeminiResponse): boolean {
  const parts = chunk.candidates?.[0]?.content?.parts;

  return parts === undefined ? false : parts.some((part) => part.functionCall !== undefined);
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
