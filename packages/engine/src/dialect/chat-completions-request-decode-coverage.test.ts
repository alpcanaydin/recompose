import { describe, expect, test } from 'vitest';

import type { TranslationRefusal } from '../refusals';
import type { ChatCompletionsRequest, ChatMessage } from './chat-completions-wire';
import type { TranslateResult } from './fates';
import type { HubMessage, HubRequest } from './hub';

import { decodeRequest } from './chat-completions-request-decode';

function chatRequest(messages: readonly ChatMessage[]): ChatCompletionsRequest {
  return { model: 'gpt-6', messages };
}

function refused(result: TranslateResult<HubRequest, TranslationRefusal>): boolean {
  return 'refusal' in result;
}

function turnsOf(result: TranslateResult<HubRequest, TranslationRefusal>): readonly HubMessage[] {
  if ('refusal' in result) throw new Error('the conversation was refused');

  return result.value.messages;
}

describe('chat completions conversations that carry nothing', () => {
  test('a conversation whose only turn is empty is refused', () => {
    expect(refused(decodeRequest(chatRequest([{ role: 'user', content: '' }])))).toBe(true);
  });

  test('a conversation of system guidance alone opens with an empty user turn', () => {
    const turns = turnsOf(decodeRequest(chatRequest([{ role: 'system', content: 'be brief' }])));

    expect(turns).toEqual([{ role: 'user', content: [{ type: 'text', text: '' }] }]);
  });
});

describe('chat completions assistant answers', () => {
  test('assistant content parts that are not text leave no answer behind', () => {
    const turns = turnsOf(
      decodeRequest(
        chatRequest([
          { role: 'user', content: 'hello' },
          {
            role: 'assistant',
            content: [{ type: 'image_url', image_url: { url: 'https://a/b.png' } }],
          },
        ]),
      ),
    );

    expect(turns).toEqual([{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]);
  });

  test('an assistant answer whose text parts are all blank leaves no answer behind', () => {
    const turns = turnsOf(
      decodeRequest(
        chatRequest([
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: [{ type: 'text', text: '' }] },
        ]),
      ),
    );

    expect(turns).toEqual([{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]);
  });
});

describe('chat completions tool calls without identifiers', () => {
  test('an unanswered tool call without an identifier never reaches the turn', () => {
    const turns = turnsOf(
      decodeRequest(
        chatRequest([
          { role: 'user', content: 'search' },
          {
            role: 'assistant',
            tool_calls: [{ type: 'function', function: { name: 'lookup', arguments: '{}' } }],
          },
        ]),
      ),
    );

    expect(turns).toEqual([{ role: 'user', content: [{ type: 'text', text: 'search' }] }]);
  });

  test('a tool result without an identifier inherits the family of the nameless call', () => {
    const turns = turnsOf(
      decodeRequest(
        chatRequest([
          { role: 'user', content: 'search' },
          {
            role: 'assistant',
            tool_calls: [{ type: 'custom', custom: { name: 'apply_patch', input: 'diff' } }],
          },
          { role: 'tool', content: 'applied' },
        ]),
      ),
    );

    expect(turns).toHaveProperty('0.content.1.family', 'custom');
  });

  test('a tool result that answers no declared call carries no family', () => {
    const turns = turnsOf(
      decodeRequest(
        chatRequest([
          { role: 'user', content: 'search' },
          { role: 'tool', content: 'applied' },
        ]),
      ),
    );

    expect(turns).toHaveProperty('0.content.1.type', 'tool_result');
    expect(turns).not.toHaveProperty('0.content.1.family');
  });
});
