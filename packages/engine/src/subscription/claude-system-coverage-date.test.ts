import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { claudeCountTokensSystem, claudeMessagesSystem } from './claude-system';

const NOON = new Date(2026, 7, 1, 12).getTime();
const STALE_DATE_REMINDER =
  "<system-reminder>\nAs you answer the user's questions, you can use the following context:\n# currentDate\nToday's date is 2020-01-01.\n</system-reminder>";
const OTHER_REMINDER =
  "<system-reminder>\nAs you answer the user's questions, mind the house style.\n</system-reminder>";

function firstUserBlocks(body: JsonObject): JsonObject[] {
  const messages: unknown = body['messages'];
  const first: unknown = Array.isArray(messages) ? messages[0] : undefined;

  if (!isJsonObject(first)) return [];

  const content: unknown = first['content'];

  return Array.isArray(content) ? content.filter(isJsonObject) : [];
}

function textsOf(blocks: readonly JsonObject[]): unknown[] {
  return blocks.map((block) => block['text']);
}

describe('the current date Claude Code puts in front of the first user turn', () => {
  it('should replace a stale date reminder the caller sent back', () => {
    const body = claudeMessagesSystem(
      {
        model: 'claude-opus-4-6',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: STALE_DATE_REMINDER },
              { type: 'text', text: 'what day is it' },
            ],
          },
        ],
      },
      NOON,
      'UTC',
    );
    const texts = textsOf(firstUserBlocks(body));

    expect(texts).toHaveLength(2);
    expect(texts[0]).toContain("Today's date is 2026-08-01.");
    expect(texts[1]).toBe('what day is it');
  });

  it('should keep a reminder that opens the same way but names no date', () => {
    const body = claudeMessagesSystem(
      {
        model: 'claude-opus-4-6',
        messages: [{ role: 'user', content: [{ type: 'text', text: OTHER_REMINDER }] }],
      },
      NOON,
      'UTC',
    );

    expect(textsOf(firstUserBlocks(body))).toHaveLength(2);
  });
});

describe('the caching Claude Code puts on the first user turn', () => {
  it('should cache the first user text that is not a reminder', () => {
    const body = claudeMessagesSystem(
      {
        model: 'claude-opus-4-6',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: OTHER_REMINDER },
              { type: 'image', source: { type: 'base64' } },
              { type: 'text', text: 'first real question' },
              { type: 'text', text: 'second question' },
            ],
          },
        ],
      },
      NOON,
      'UTC',
    );
    const blocks = firstUserBlocks(body);

    expect(blocks[1]).not.toHaveProperty('cache_control');
    expect(blocks[3]).toHaveProperty('cache_control', { type: 'ephemeral' });
    expect(blocks[4]).not.toHaveProperty('cache_control');
  });

  it('should leave a conversation with no user turn without any date reminder', () => {
    const messages = [{ role: 'assistant', content: 'unprompted' }];
    const body = claudeMessagesSystem({ model: 'claude-opus-4-6', messages }, NOON, 'UTC');

    expect(body).toEqual({ model: 'claude-opus-4-6', messages });
  });

  it('should read a user turn whose content arrived as one plain string', () => {
    const body = claudeMessagesSystem(
      { model: 'claude-opus-4-6', messages: [{ role: 'user', content: 'hello' }] },
      NOON,
      'UTC',
    );

    expect(textsOf(firstUserBlocks(body))[1]).toBe('hello');
  });

  it('should leave the date out of a token count, which never generates', () => {
    const body = claudeCountTokensSystem({
      model: 'claude-opus-5',
      system: 'house style',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(JSON.stringify(body)).not.toContain('# currentDate');
    expect(body).toHaveProperty('messages.1.role', 'system');
  });
});
