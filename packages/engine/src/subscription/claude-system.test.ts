import { describe, expect, test } from 'vitest';

import { claudeCountTokensSystem, claudeMessagesSystem } from './claude-system';

const fixed = new Date(2026, 7, 1, 12).getTime();

describe('Claude Code system cloaking', () => {
  test('moves caller system into a modern mid-conversation system message', () => {
    const body = claudeMessagesSystem(
      {
        model: 'claude-opus-5',
        system: [{ type: 'text', text: 'caller rules' }],
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'answer' },
        ],
      },
      fixed,
    );

    expect(body).not.toHaveProperty('system');
    expect(body).toHaveProperty('messages.1', {
      role: 'system',
      content: [{ type: 'text', text: 'caller rules', cache_control: { type: 'ephemeral' } }],
    });
  });
});

describe('legacy Claude system cloaking', () => {
  test('uses a legacy reminder after leading tool results', () => {
    const body = claudeMessagesSystem(
      {
        model: 'claude-sonnet-4-5',
        system: 'caller rules',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'tool_1', content: 'ok' },
              { type: 'text', text: 'next' },
            ],
          },
        ],
      },
      fixed,
    );

    expect(body).toHaveProperty('messages.0.content.1.type', 'tool_result');
    expect(body).toHaveProperty(
      'messages.0.content.2.text',
      '<system-reminder>\ncaller rules\n</system-reminder>',
    );
    expect(body).toHaveProperty('messages.0.content.3.text', 'next');
  });

  test('prepends the native current-date block and caches first real user text', () => {
    const body = claudeMessagesSystem(
      { model: 'claude-opus-5', messages: [{ role: 'user', content: 'hello' }] },
      fixed,
    );

    expect(body).toHaveProperty(
      'messages.0.content.0.text',
      expect.stringContaining("Today's date is 2026-08-01."),
    );
    expect(body).toHaveProperty('messages.0.content.1', {
      type: 'text',
      text: 'hello',
      cache_control: { type: 'ephemeral' },
    });
  });

  test('count_tokens relocates caller system without generation-only current date', () => {
    const body = claudeCountTokensSystem({
      model: 'claude-opus-5',
      system: 'caller rules',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(JSON.stringify(body)).not.toContain('# currentDate');
    expect(body).toHaveProperty('messages.1.role', 'system');
  });
});
