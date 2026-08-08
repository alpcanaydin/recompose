import { describe, expect, it } from 'vitest';

import type { ChatCompletionsRequest } from './chat-completions-wire';
import type { HubRequest } from './hub';

import { decodeRequest } from './chat-completions-request';
import { aChatRequest, aChatTool } from './chat-completions.testkit';

function decodedValue(request: ChatCompletionsRequest): HubRequest {
  const result = decodeRequest(request);

  if ('refusal' in result) {
    throw new Error(`expected a translation, met a refusal: ${JSON.stringify(result.refusal)}`);
  }

  return result.value;
}

function schemaOf(request: ChatCompletionsRequest) {
  return decodedValue(request).tools?.[0]?.inputSchema;
}

describe('decodeRequest normalizes a root schema union to an object schema', () => {
  it('merges root anyOf properties without merging branch required fields', () => {
    const request = aChatRequest({
      tools: [
        aChatTool({
          type: 'function',
          function: {
            name: 'pick',
            parameters: {
              anyOf: [{ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] }],
            },
          },
        }),
      ],
    });

    expect(schemaOf(request)).toEqual({
      type: 'object',
      properties: { a: { type: 'string' } },
    });
  });

  it('keeps root properties but drops required that rides alongside a root anyOf', () => {
    const request = aChatRequest({
      tools: [
        aChatTool({
          type: 'function',
          function: {
            name: 'pick',
            parameters: {
              anyOf: [{ type: 'object' }],
              properties: { a: { type: 'string' } },
              required: ['a'],
            },
          },
        }),
      ],
    });

    expect(schemaOf(request)).toEqual({
      type: 'object',
      properties: { a: { type: 'string' } },
    });
  });
});

describe('decodeRequest normalizes a root oneOf schema', () => {
  it('normalizes a root oneOf the same way while keeping root properties', () => {
    const request = aChatRequest({
      tools: [
        aChatTool({
          type: 'function',
          function: {
            name: 'pick',
            parameters: { oneOf: [{ type: 'object' }], properties: { b: { type: 'number' } } },
          },
        }),
      ],
    });

    expect(schemaOf(request)).toEqual({
      type: 'object',
      properties: { b: { type: 'number' } },
    });
  });
});

describe('decodeRequest carries a plain object tool schema through unchanged', () => {
  it('keeps the properties and required of a schema that names no union', () => {
    const request = aChatRequest({
      tools: [
        aChatTool({
          type: 'function',
          function: {
            name: 'pick',
            parameters: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
          },
        }),
      ],
    });

    expect(schemaOf(request)).toEqual({
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a'],
    });
  });
});
