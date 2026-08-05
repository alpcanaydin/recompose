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

describe('decodeRequest normalizes a root schema union to a bare object schema', () => {
  it('drops a root anyOf and never merges the required a branch declares', () => {
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

    expect(schemaOf(request)).toEqual({ type: 'object', properties: {} });
  });

  it('drops the stray root properties and required that ride alongside a root anyOf', () => {
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

    expect(schemaOf(request)).toEqual({ type: 'object', properties: {} });
  });

  it('normalizes a root oneOf the same way, dropping its stray root properties', () => {
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

    expect(schemaOf(request)).toEqual({ type: 'object', properties: {} });
  });
});
