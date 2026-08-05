import { fc } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import type { ResponsesContentPart, ResponsesInputItem, ResponsesRequest } from './responses-wire';

import { decodeRequest, encodeRequest } from './responses-codec';
import { expectTranslation } from './responses.testkit';

const identifier = fc.string({ minLength: 1, maxLength: 8 });
const idAlphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
const safeIdentifier = fc
  .array(fc.constantFrom(...idAlphabet.split('')), { minLength: 1, maxLength: 8 })
  .map((chars) => chars.join(''));
const toolArguments = fc.dictionary(identifier, fc.oneof(fc.string(), fc.integer(), fc.boolean()), {
  maxKeys: 3,
});

const textMessage = fc
  .record({ role: fc.constantFrom('user', 'assistant'), text: fc.string() })
  .map(({ role, text }): ResponsesInputItem => {
    const part: ResponsesContentPart =
      role === 'assistant' ? { type: 'output_text', text } : { type: 'input_text', text };

    return { type: 'message', role, content: [part] };
  });

const toolExchange = fc
  .record({ callId: safeIdentifier, name: identifier, args: toolArguments, output: fc.string() })
  .map(({ callId, name, args, output }): ResponsesInputItem[] => [
    { type: 'function_call', call_id: callId, name, arguments: JSON.stringify(args) },
    { type: 'function_call_output', call_id: callId, output },
  ]);

const inputItems = fc
  .array(
    fc.oneof(
      textMessage.map((item) => [item]),
      toolExchange,
    ),
    { minLength: 1, maxLength: 6 },
  )
  .map((groups) => groups.flat());

const toolDefinition = fc.record({
  type: fc.constant('function' as const),
  name: identifier,
  parameters: fc.constant({ type: 'object' as const, properties: {} }),
});

const responsesRequest = fc.record({
  instructions: fc.string(),
  input: inputItems,
  tools: fc.array(toolDefinition, { maxLength: 3 }),
});

function toolNames(tools: readonly { name: string }[] | undefined): string[] | undefined {
  return tools?.map((tool) => tool.name);
}

describe('the Responses request round trip settles the hub across a wire crossing', () => {
  it('re-encodes a decoded request to the same hub, and keeps its instructions and tools', () => {
    fc.assert(
      fc.property(responsesRequest, (request: ResponsesRequest) => {
        const once = expectTranslation(decodeRequest(request));
        const encoded = expectTranslation(encodeRequest(once.value));
        const twice = expectTranslation(decodeRequest(encoded.value));

        expect(twice.value).toEqual(once.value);
        expect(encoded.value.instructions).toBe(request.instructions);
        expect(toolNames(encoded.value.tools)).toEqual(toolNames(request.tools));
      }),
    );
  });
});
