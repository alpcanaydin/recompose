import { describe, expect, it } from 'vitest';

import type { ChatCompletionsRequest, ChatTool } from './chat-completions-wire';

import { decodeRequest } from './chat-completions-codec';
import { aChatRequest, aChatTool } from './chat-completions.testkit';

function translationOf(request: ChatCompletionsRequest) {
  const result = decodeRequest(request);

  if ('refusal' in result) {
    throw new Error(`expected a translation, met a refusal: ${JSON.stringify(result.refusal)}`);
  }

  return result;
}

function aUnionTool(name: string): ChatTool {
  return aChatTool({
    type: 'function',
    function: {
      name,
      parameters: { anyOf: [{ type: 'object', properties: { a: { type: 'string' } } }] },
    },
  });
}

const droppedUnionFate = {
  field: 'tools[schema union]',
  disposition: 'mapped',
  to: 'absent',
};

describe('decodeRequest names the tool schema union it drops', () => {
  it('records the dropped root union as a mapped loss while normalizing to a bare object', () => {
    const { value, fates } = translationOf(aChatRequest({ tools: [aUnionTool('pick')] }));

    expect(value.tools?.[0]?.inputSchema).toEqual({ type: 'object', properties: {} });
    expect(fates).toContainEqual(droppedUnionFate);
  });

  it('records no union drop when every tool schema names a plain object', () => {
    const { fates } = translationOf(aChatRequest({ tools: [aChatTool()] }));

    expect(fates).not.toContainEqual(expect.objectContaining({ field: 'tools[schema union]' }));
  });

  it('records the union drop when only one tool among several carries a root union', () => {
    const { fates } = translationOf(aChatRequest({ tools: [aChatTool(), aUnionTool('pick')] }));

    expect(fates).toContainEqual(droppedUnionFate);
  });
});
