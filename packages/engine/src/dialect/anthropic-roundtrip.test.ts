import { fc } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import type { AnthropicMessage, AnthropicRequest } from './anthropic-wire';
import type { HubRequest } from './hub';

import { decodeRequest, encodeRequest } from './anthropic-request';

const identifier = fc.string({ minLength: 1, maxLength: 8 });
const idAlphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
const safeIdentifier = fc
  .array(fc.constantFrom(...idAlphabet.split('')), { minLength: 1, maxLength: 8 })
  .map((chars) => chars.join(''));
const prose = fc.string({ minLength: 1, maxLength: 16 });
const toolInput = fc.dictionary(identifier, fc.oneof(fc.string(), fc.integer(), fc.boolean()), {
  maxKeys: 3,
});

const wireTextTurn = fc
  .record({ role: fc.constantFrom('user', 'assistant'), text: prose })
  .map(({ role, text }): AnthropicMessage => ({ role, content: [{ type: 'text', text }] }));

const wireThinkingTurn = fc.record({ thinking: prose, signature: safeIdentifier }).map(
  ({ thinking, signature }): AnthropicMessage => ({
    role: 'assistant',
    content: [{ type: 'thinking', thinking, signature }],
  }),
);

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
      wireThinkingTurn.map((turn) => [turn]),
      wireToolTurn,
    ),
    { minLength: 1, maxLength: 6 },
  )
  .map((turns) => turns.flat());

function blockTrail(messages: readonly AnthropicMessage[]): unknown[] {
  return messages.flatMap((message): unknown[] =>
    typeof message.content === 'string'
      ? [{ role: message.role, block: { type: 'text', text: message.content } }]
      : message.content.map((block) => ({ role: message.role, block })),
  );
}

function decodedHub(request: AnthropicRequest): HubRequest {
  const decoded = decodeRequest(request);

  if ('refusal' in decoded) {
    throw new Error(`expected a decoded hub request: ${JSON.stringify(decoded)}`);
  }

  return decoded.value;
}

function throughTheHub(request: AnthropicRequest): AnthropicRequest {
  return encodeRequest(decodedHub(request)).value;
}

describe('the wire request settles through the hub', () => {
  it('reaches a fixed point one crossing no longer drifts from', () => {
    fc.assert(
      fc.property(wireMessages, (messages: readonly AnthropicMessage[]) => {
        const settled = throughTheHub(throughTheHub({ max_tokens: 1024, messages }));
        const again = throughTheHub(settled);

        expect(again).toEqual(settled);
      }),
    );
  });

  it('keeps every content block whole on the first crossing', () => {
    fc.assert(
      fc.property(wireMessages, (messages: readonly AnthropicMessage[]) => {
        const crossed = throughTheHub({ max_tokens: 1024, messages });

        expect(blockTrail(crossed.messages)).toEqual(blockTrail(messages));
      }),
    );
  });
});
