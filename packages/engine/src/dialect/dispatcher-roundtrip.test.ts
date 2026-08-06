import { fc } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import type {
  AnthropicContentBlock,
  AnthropicMessage,
  AnthropicRequest,
  AnthropicTextBlock,
  AnthropicToolResultBlock,
  AnthropicToolUseBlock,
} from './anthropic-wire';
import type { ResponsesContentPart, ResponsesInputItem, ResponsesRequest } from './responses-wire';

import { translateRequest } from './dispatcher';

const identifier = fc.string({ minLength: 1, maxLength: 8 });
const idAlphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
const safeIdentifier = fc
  .array(fc.constantFrom(...idAlphabet.split('')), { minLength: 1, maxLength: 8 })
  .map((chars) => chars.join(''));
const prose = fc.string({ minLength: 1, maxLength: 16 });
const toolInput = fc.dictionary(identifier, fc.oneof(fc.string(), fc.integer(), fc.boolean()), {
  maxKeys: 3,
});

function contentBlockSignature(
  role: AnthropicMessage['role'],
  block: AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock,
): unknown {
  switch (block.type) {
    case 'text':
      return { kind: 'text', role, text: block.text };
    case 'tool_use':
      return { kind: 'use', id: block.id, name: block.name };
    case 'tool_result':
      return { kind: 'result', id: block.tool_use_id };

    default: {
      const unhandled: never = block;

      throw new Error(`unhandled wire block: ${JSON.stringify(unhandled)}`);
    }
  }
}

function blockSignature(role: AnthropicMessage['role'], block: AnthropicContentBlock): unknown {
  if (block.type === 'thinking') {
    return { kind: 'thinking', text: block.thinking };
  }

  if (block.type === 'redacted_thinking') {
    return { kind: 'redacted_thinking', data: block.data };
  }

  if (block.type === 'image') {
    return { kind: 'image', source: block.source.type };
  }

  if (block.type === 'document') {
    return { kind: 'document', source: block.source['type'] };
  }

  return contentBlockSignature(role, block);
}

function messageSignature(message: AnthropicMessage): unknown[] {
  if (typeof message.content === 'string') {
    return [{ kind: 'text', role: message.role, text: message.content }];
  }

  return message.content.map((block) => blockSignature(message.role, block));
}

function wireSignature(messages: readonly AnthropicMessage[]): unknown[] {
  return messages.flatMap(messageSignature);
}

const wireTextTurn = fc
  .record({ role: fc.constantFrom('user', 'assistant'), text: prose })
  .map(({ role, text }): AnthropicMessage => ({ role, content: [{ type: 'text', text }] }));

const wireToolTurn = fc
  .record({ id: safeIdentifier, name: identifier, input: toolInput, output: prose })
  .map(({ id, name, input, output }): AnthropicMessage[] => [
    { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
    {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: output }] },
      ],
    },
  ]);

const wireMessages = fc
  .array(
    fc.oneof(
      wireTextTurn.map((turn) => [turn]),
      wireToolTurn,
    ),
    { minLength: 1, maxLength: 6 },
  )
  .map((turns) => turns.flat());

function expectTranslatedRequest<Body>(
  result:
    | { outcome: 'passthrough' }
    | { value: Body; fates: readonly unknown[] }
    | { refusal: unknown },
): { value: Body; fates: readonly unknown[] } {
  if ('outcome' in result || 'refusal' in result) {
    throw new Error(`expected a translated body: ${JSON.stringify(result)}`);
  }

  return result;
}

function throughChat(wire: AnthropicRequest): AnthropicRequest {
  const toChat = expectTranslatedRequest(translateRequest('anthropic', 'chat-completions', wire));

  return expectTranslatedRequest(translateRequest('chat-completions', 'anthropic', toChat.value))
    .value;
}

describe('the round trip Anthropic to Chat Completions to Anthropic settles the wire', () => {
  it('reaches a fixed point the chat crossing no longer drifts from', () => {
    fc.assert(
      fc.property(wireMessages, (messages: readonly AnthropicMessage[]) => {
        const settled = throughChat(throughChat({ max_tokens: 1024, messages }));
        const again = throughChat(settled);

        expect(wireSignature(again.messages)).toEqual(wireSignature(settled.messages));
      }),
    );
  });
});

function textOf(content: string | readonly ResponsesContentPart[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content.map((part) => ('text' in part ? part.text : '')).join('');
}

function responsesSignature(input: readonly ResponsesInputItem[]): unknown[] {
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

const responsesTextTurn = fc
  .record({ role: fc.constantFrom('user', 'assistant'), text: prose })
  .map(({ role, text }): ResponsesInputItem => {
    const part: ResponsesContentPart =
      role === 'assistant' ? { type: 'output_text', text } : { type: 'input_text', text };

    return { type: 'message', role, content: [part] };
  });

const responsesToolTurn = fc
  .record({ callId: safeIdentifier, name: identifier, input: toolInput, output: prose })
  .map(({ callId, name, input, output }): ResponsesInputItem[] => [
    { type: 'function_call', call_id: callId, name, arguments: JSON.stringify(input) },
    { type: 'function_call_output', call_id: callId, output },
  ]);

const responsesInput = fc
  .array(
    fc.oneof(
      responsesTextTurn.map((turn) => [turn]),
      responsesToolTurn,
    ),
    { minLength: 1, maxLength: 6 },
  )
  .map((turns) => turns.flat());

function throughAnthropic(responses: ResponsesRequest): ResponsesRequest {
  const toWire = expectTranslatedRequest(translateRequest('responses', 'anthropic', responses));

  return expectTranslatedRequest(translateRequest('anthropic', 'responses', toWire.value)).value;
}

describe('the round trip Responses to Anthropic to Responses settles the input', () => {
  it('re-crosses a hub-normalized Responses input without drift, preserving pairing', () => {
    fc.assert(
      fc.property(responsesInput, (input: readonly ResponsesInputItem[]) => {
        const once = throughAnthropic({ input });
        const twice = throughAnthropic(once);

        expect(responsesSignature(twice.input)).toEqual(responsesSignature(once.input));
      }),
    );
  });
});
