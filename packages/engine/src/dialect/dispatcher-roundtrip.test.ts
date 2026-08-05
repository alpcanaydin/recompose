import { fc } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import type {
  HubContentBlock,
  HubMessage,
  HubRequest,
  HubTextBlock,
  HubToolResultBlock,
  HubToolUseBlock,
} from './hub';
import type { ResponsesContentPart, ResponsesInputItem, ResponsesRequest } from './responses-wire';

import { translateRequest } from './dispatcher';

const identifier = fc.string({ minLength: 1, maxLength: 8 });
const prose = fc.string({ minLength: 1, maxLength: 16 });
const toolInput = fc.dictionary(identifier, fc.oneof(fc.string(), fc.integer(), fc.boolean()), {
  maxKeys: 3,
});

function contentBlockSignature(
  role: HubMessage['role'],
  block: HubTextBlock | HubToolUseBlock | HubToolResultBlock,
): unknown {
  switch (block.type) {
    case 'text':
      return { kind: 'text', role, text: block.text };
    case 'tool_use':
      return { kind: 'use', id: block.id, name: block.name };
    case 'tool_result':
      return { kind: 'result', id: block.toolUseId };

    default: {
      const unhandled: never = block;

      throw new Error(`unhandled hub block: ${JSON.stringify(unhandled)}`);
    }
  }
}

function blockSignature(role: HubMessage['role'], block: HubContentBlock): unknown {
  if (block.type === 'thinking') {
    return { kind: 'thinking', text: block.text };
  }

  if (block.type === 'redacted_thinking') {
    return { kind: 'redacted_thinking', data: block.data };
  }

  if (block.type === 'image') {
    return { kind: 'image', source: block.source.type };
  }

  return contentBlockSignature(role, block);
}

function hubSignature(messages: readonly HubMessage[]): unknown[] {
  return messages.flatMap((message) =>
    message.content.map((block) => blockSignature(message.role, block)),
  );
}

const hubTextTurn = fc
  .record({ role: fc.constantFrom('user', 'assistant'), text: prose })
  .map(({ role, text }): HubMessage => ({ role, content: [{ type: 'text', text }] }));

const hubToolTurn = fc
  .record({ id: identifier, name: identifier, input: toolInput, output: prose })
  .map(({ id, name, input, output }): HubMessage[] => [
    { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
    {
      role: 'user',
      content: [{ type: 'tool_result', toolUseId: id, content: [{ type: 'text', text: output }] }],
    },
  ]);

const hubMessages = fc
  .array(
    fc.oneof(
      hubTextTurn.map((turn) => [turn]),
      hubToolTurn,
    ),
    { maxLength: 6 },
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

describe('the round trip Anthropic to Chat Completions to Anthropic preserves content and tool pairing', () => {
  it('carries every text block and tool-call pairing back to the Anthropic hub unchanged', () => {
    fc.assert(
      fc.property(hubMessages, (messages: readonly HubMessage[]) => {
        const source: HubRequest = { messages };
        const toChat = expectTranslatedRequest(
          translateRequest('anthropic', 'chat-completions', source),
        );
        const back = expectTranslatedRequest(
          translateRequest('chat-completions', 'anthropic', toChat.value),
        );

        expect(hubSignature(back.value.messages)).toEqual(hubSignature(messages));
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
  .record({ callId: identifier, name: identifier, input: toolInput, output: prose })
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
    { maxLength: 6 },
  )
  .map((turns) => turns.flat());

describe('the round trip Responses to Anthropic to Responses preserves content and tool pairing', () => {
  it('carries every message and tool-call pairing back to the Responses input unchanged', () => {
    fc.assert(
      fc.property(responsesInput, (input: readonly ResponsesInputItem[]) => {
        const source: ResponsesRequest = { input };
        const toHub = expectTranslatedRequest(translateRequest('responses', 'anthropic', source));
        const back = expectTranslatedRequest(
          translateRequest('anthropic', 'responses', toHub.value),
        );

        expect(responsesSignature(back.value.input)).toEqual(responsesSignature(input));
      }),
    );
  });
});
