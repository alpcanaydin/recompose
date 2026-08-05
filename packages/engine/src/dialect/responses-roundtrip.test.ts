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

function textOf(content: string | readonly ResponsesContentPart[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content.map((part) => ('text' in part ? part.text : '')).join('');
}

function toolNames(tools: readonly { name: string }[] | undefined): string[] | undefined {
  return tools?.map((tool) => tool.name);
}

function inputSignature(input: readonly ResponsesInputItem[]): unknown[] {
  return input.map((item) => {
    switch (item.type) {
      case 'message':
        return { kind: 'message', role: item.role, text: textOf(item.content) };
      case 'function_call':
        return { kind: 'call', call_id: item.call_id, name: item.name };
      case 'function_call_output':
        return { kind: 'output', call_id: item.call_id, output: item.output };
      case 'reasoning':
        return { kind: 'reasoning' };

      default: {
        const unhandled: never = item;

        throw new Error(`unhandled input item: ${JSON.stringify(unhandled)}`);
      }
    }
  });
}

describe('the Responses request round trip preserves instructions, tools, and input', () => {
  it('carries a decoded request back out unchanged in its instructions, tools, and input', () => {
    fc.assert(
      fc.property(responsesRequest, (request: ResponsesRequest) => {
        const { value } = expectTranslation(decodeRequest(request));
        const encoded = expectTranslation(encodeRequest(value));

        expect(encoded.value.instructions).toBe(request.instructions);
        expect(toolNames(encoded.value.tools)).toEqual(toolNames(request.tools));
        expect(inputSignature(encoded.value.input)).toEqual(inputSignature(request.input));
      }),
    );
  });
});
