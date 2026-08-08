import { describe, expect, test } from 'vitest';

import type { Crossing } from './gateway-wire';

import { isAnthropicAnswer, translatedResponse } from './gateway-response-translation';

function crossingTo(dialect: Crossing['dialect']): Crossing {
  return {
    dialect,
    raw: {},
    gatewayName: 'Build',
    virtualModel: 'fast',
    providerModel: 'claude-sonnet-4-5',
  };
}

describe('recognising a Claude answer on the wire', () => {
  test('an answer that never stopped is still a Claude answer', () => {
    expect(
      isAnthropicAnswer({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [],
        stop_reason: null,
      }),
    ).toBe(true);
  });

  test('an answer naming its stop reason is a Claude answer', () => {
    expect(
      isAnthropicAnswer({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [],
        stop_reason: 'end_turn',
      }),
    ).toBe(true);
  });

  test('an answer whose stop reason is a number is not a Claude answer', () => {
    expect(
      isAnthropicAnswer({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [],
        stop_reason: 7,
      }),
    ).toBe(false);
  });

  test('an answer without the Claude envelope is not a Claude answer', () => {
    expect(isAnthropicAnswer({ id: 'msg_1', type: 'message', content: [] })).toBe(false);
  });
});

describe('refusing to translate an answer the provider dialect does not describe', () => {
  test.each([
    ['chat-completions', { choices: 'not a list' }],
    ['interactions', { id: 'int_1' }],
    ['responses', { id: 'resp_1' }],
    ['anthropic', { id: 'msg_1' }],
    ['gemini', { candidates: 'not a list' }],
  ] as const)('a %s answer of the wrong shape translates to nothing', (from, answer) => {
    expect(translatedResponse(from, crossingTo('anthropic'), answer)).toBeNull();
  });
});
