import { describe, expect, it } from 'vitest';

import { ingressPayload, isJsonObject, parsedJson } from '../gateway-wire';
import { translateRequest } from './dispatcher';
import { translateRequestToGemini } from './gemini-bridge';

describe('Interactions function declaration groups', () => {
  it('should flatten both declaration spellings, deduplicate names, and clean schemas', () => {
    const translated = translateRequest('interactions', 'responses', {
      input: 'hi',
      tools: [
        {
          functionDeclarations: [
            {
              name: 'lookup',
              description: 'Lookup data',
              parameters: {
                type: 'object',
                $schema: 'http://json-schema.org/draft-07/schema#',
                properties: { q: { type: 'string' } },
              },
            },
            { name: 'read', parameters: { type: 'object' } },
          ],
        },
        {
          function_declarations: [
            { name: 'lookup', description: 'duplicate' },
            { name: 'write', parameters: { type: 'object' } },
          ],
        },
      ],
    });

    expect(translated).toHaveProperty(
      'value.tools',
      expect.arrayContaining([
        expect.objectContaining({ type: 'function', name: 'lookup' }),
        expect.objectContaining({ type: 'function', name: 'read' }),
        expect.objectContaining({ type: 'function', name: 'write' }),
      ]),
    );
    expect(translated).not.toHaveProperty('value.tools.0.parameters.$schema');
    expect(translated).toHaveProperty('value.tools.0.parameters.properties.q.type', 'string');
  });
});

describe('Interactions function tool choice', () => {
  it('should accept the nested function tool-choice spelling', () => {
    const translated = translateRequest('interactions', 'responses', {
      input: 'hi',
      tools: [{ type: 'function', name: 'lookup' }],
      generation_config: {
        tool_choice: { type: 'function', function: { name: 'lookup' } },
      },
    });

    expect(translated).toHaveProperty('value.tool_choice', {
      type: 'function',
      name: 'lookup',
    });
  });

  it('should normalize non-string names before Gemini translation', () => {
    const parsed = parsedJson(
      '{"model":"fast","input":[{"type":"function_call","name":true,"arguments":{}}],"tools":[{"type":"function","name":true}],"generation_config":{"tool_choice":{"type":"function","name":true}}}',
    );

    if (!isJsonObject(parsed)) throw new Error('raw Interactions request failed to parse');

    const request = ingressPayload('interactions', parsed);

    if (request === null) throw new Error('raw Interactions request failed validation');

    const translated = translateRequestToGemini('interactions', request);

    expect(translated).toHaveProperty('value.contents.0.parts.0.functionCall.name', 'true');
    expect(translated).toHaveProperty('value.tools.0.functionDeclarations.0.name', 'true');
    expect(translated).toHaveProperty(
      'value.toolConfig.functionCallingConfig.allowedFunctionNames.0',
      'true',
    );
  });
});
