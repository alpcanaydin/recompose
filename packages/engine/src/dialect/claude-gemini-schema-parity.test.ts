import { describe, expect, it } from 'vitest';

import { translateRequest } from './dispatcher';

describe('Gemini tool schemas crossing Claude', () => {
  it('should preserve an already canonical Claude schema', () => {
    const schema = {
      type: 'object',
      properties: { value: { type: 'string' } },
      additionalProperties: false,
      $schema: 'http://json-schema.org/draft-07/schema#',
    };
    const value = geminiToClaude(schema);

    expect(value.tools?.[0]?.input_schema).toEqual(schema);
  });

  it('should correct malformed additionalProperties and schema declarations', () => {
    const value = geminiToClaude({ type: 'object', additionalProperties: 'false', $schema: 123 });

    expect(value.tools?.[0]?.input_schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      $schema: 'http://json-schema.org/draft-07/schema#',
    });
  });
});

describe('Claude schema types crossing Gemini', () => {
  it('should stringify a non-string root type', () => {
    expect(claudeToGemini({ type: 123 })).toHaveProperty('type', 'object');
  });

  it('should lowercase nested uppercase types', () => {
    expect(
      claudeToGemini({
        type: 'OBJECT',
        properties: { value: { type: 'STRING' } },
      }),
    ).toMatchObject({ type: 'object', properties: { value: { type: 'string' } } });
  });
});

function geminiToClaude(schema: Record<string, unknown>) {
  const translated = translateRequest('gemini', 'anthropic', {
    contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    tools: [{ functionDeclarations: [{ name: 'lookup', parameters: schema }] }],
  });

  if ('outcome' in translated || 'refusal' in translated) throw new Error('expected request');

  return translated.value;
}

function claudeToGemini(schema: Record<string, unknown>) {
  const value = translatedClaudeToGemini(schema);
  const tools = value.tools;

  if (tools === undefined) throw new Error('expected tools');

  const group = tools[0];

  if (group === undefined) throw new Error('expected tool group');

  const declaration = group.functionDeclarations[0];

  if (declaration === undefined) throw new Error('expected tool declaration');

  return declaration.parameters;
}

function translatedClaudeToGemini(schema: Record<string, unknown>) {
  const translated = translateRequest('anthropic', 'gemini', {
    messages: [{ role: 'user', content: 'hi' }],
    tools: [{ name: 'lookup', input_schema: schema }],
  });

  if ('outcome' in translated) throw new Error('expected request');
  if ('refusal' in translated) throw new Error('expected request');

  return translated.value;
}
