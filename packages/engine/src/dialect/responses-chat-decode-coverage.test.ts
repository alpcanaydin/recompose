import { describe, expect, test } from 'vitest';

import type { HubMessage, HubRequest } from './hub';
import type { ResponsesRequest } from './responses-wire';

import {
  mergeResponsesMessagesForChat,
  restoreResponsesChatToolIds,
} from './responses-chat-decode';

function assistantSaying(text: string): HubMessage {
  return { role: 'assistant', content: [{ type: 'text', text }] };
}

function requestHolding(...messages: readonly HubMessage[]): HubRequest {
  return { messages };
}

function callFor(callId: string): ResponsesRequest {
  return {
    input: [
      { type: 'message', role: 'user', content: 'look this up' },
      { type: 'function_call', call_id: callId, name: 'lookup', arguments: '{}' },
      { type: 'function_call_output', call_id: callId, output: 'done' },
    ],
  };
}

function toolIdsIn(value: HubRequest): string[] {
  return value.messages.flatMap((message) =>
    message.content.flatMap((block) => {
      if (block.type === 'tool_use') return [block.id];

      return block.type === 'tool_result' ? [block.toolUseId] : [];
    }),
  );
}

describe('merging Responses turns for a Chat Completions target', () => {
  test('consecutive assistant turns become one turn', () => {
    const merged = mergeResponsesMessagesForChat([
      assistantSaying('first'),
      assistantSaying('second'),
    ]);

    expect(merged).toStrictEqual([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'first' },
          { type: 'text', text: 'second' },
        ],
      },
    ]);
  });

  test('a turn carrying nothing is dropped rather than sent empty', () => {
    const merged = mergeResponsesMessagesForChat([
      { role: 'user', content: [] },
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]);

    expect(merged).toStrictEqual([{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]);
  });

  test('a user turn between two assistant turns keeps them apart', () => {
    const merged = mergeResponsesMessagesForChat([
      assistantSaying('first'),
      { role: 'user', content: [{ type: 'text', text: 'and?' }] },
      assistantSaying('second'),
    ]);

    expect(merged).toHaveLength(3);
  });
});

describe('restoring the tool identifiers a Responses turn arrived with', () => {
  test('a sanitized identifier is restored to the one the caller sent', () => {
    const value = requestHolding({
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'call_a_b', name: 'lookup', input: {} },
        { type: 'tool_result', toolUseId: 'call_a_b', content: [] },
      ],
    });

    expect(toolIdsIn(restoreResponsesChatToolIds(value, callFor('call.a.b')))).toStrictEqual([
      'call.a.b',
      'call.a.b',
    ]);
  });

  test('an identifier the turn never carried is left as it stands', () => {
    const value = requestHolding({
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'call_unknown', name: 'lookup', input: {} },
        { type: 'tool_result', toolUseId: 'call_unknown', content: [] },
      ],
    });

    expect(toolIdsIn(restoreResponsesChatToolIds(value, { input: [] }))).toStrictEqual([
      'call_unknown',
      'call_unknown',
    ]);
  });

  test('blocks that are not tool traffic pass through untouched', () => {
    const value = requestHolding(assistantSaying('plain'));

    expect(restoreResponsesChatToolIds(value, { input: [] })).toStrictEqual(value);
  });
});
