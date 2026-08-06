import { fc } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import type {
  ResponsesContentPart,
  ResponsesInputItem,
  ResponsesRequest,
  ResponsesTool,
} from './responses-wire';

import { decodeRequest, encodeRequest } from './responses-codec';
import { expectTranslation } from './responses.testkit';

const identifier = fc.string({ minLength: 1, maxLength: 8 });
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

type ToolExchange = { name: string; args: Record<string, unknown>; output: string };

const toolExchange = fc.record({
  name: identifier,
  args: toolArguments,
  output: fc.string(),
});

function exchangeItems(exchange: ToolExchange, index: number): ResponsesInputItem[] {
  const callId = `call_${String(index)}`;

  return [
    {
      type: 'function_call',
      call_id: callId,
      name: exchange.name,
      arguments: JSON.stringify(exchange.args),
    },
    { type: 'function_call_output', call_id: callId, output: exchange.output },
  ];
}

const inputItems = fc
  .array(
    fc.oneof(
      textMessage.map((item): { text: ResponsesInputItem } => ({ text: item })),
      toolExchange.map((exchange): { exchange: ToolExchange } => ({ exchange })),
    ),
    { minLength: 1, maxLength: 6 },
  )
  .map((groups) =>
    groups.flatMap((group, index): ResponsesInputItem[] =>
      'text' in group ? [group.text] : exchangeItems(group.exchange, index),
    ),
  );

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

function toolNames(tools: readonly ResponsesTool[] | undefined): string[] | undefined {
  return tools?.flatMap((tool) => (tool.type === 'function' ? [tool.name] : []));
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
