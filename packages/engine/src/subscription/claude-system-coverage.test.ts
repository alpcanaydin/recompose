import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { claudeMessagesSystem } from './claude-system';

const NOON = new Date(2026, 7, 1, 12).getTime();
const CLI_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";

function cloaked(body: JsonObject): JsonObject {
  return claudeMessagesSystem(body, NOON, 'UTC');
}

function messagesOf(body: JsonObject): unknown[] {
  const messages = body['messages'];

  return Array.isArray(messages) ? messages : [];
}

describe('the caller system text Claude Code is allowed to forward', () => {
  it('should forward nothing that Claude Code sends natively or leaves blank', () => {
    const body = cloaked({
      model: 'claude-opus-4-6',
      system: [
        { type: 'text', text: CLI_IDENTITY },
        { type: 'text', text: 'x-anthropic-billing-header: account-1' },
        { type: 'text', text: '   ' },
        { type: 'text', text: 42 },
        { type: 'image', source: { type: 'base64' } },
        'a bare string block',
      ],
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(body).not.toHaveProperty('system');
    expect(messagesOf(body)).toHaveLength(1);
  });

  it('should forward a caller system prompt sent as one plain string', () => {
    const body = cloaked({
      model: 'claude-opus-5',
      system: 'Follow the house style.',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(body).toHaveProperty('messages.1.content.0.text', 'Follow the house style.');
  });

  it('should forward nothing when the caller sends no system field at all', () => {
    const body = cloaked({ model: 'claude-opus-4-6', messages: [{ role: 'user', content: 'x' }] });

    expect(messagesOf(body)).toHaveLength(1);
  });
});

describe('the model spelling that decides how the system text travels', () => {
  it('should read a legacy model name through the provider prefix the caller used', () => {
    const body = cloaked({
      model: 'Anthropic/Claude-Sonnet-4-5',
      system: 'house style',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(body).toHaveProperty(
      'messages.0.content.1.text',
      '<system-reminder>\nhouse style\n</system-reminder>',
    );
  });

  it('should treat a body that names no model as a modern one', () => {
    const body = cloaked({ system: 'house style', messages: [{ role: 'user', content: 'x' }] });

    expect(body).toHaveProperty('messages.1.role', 'system');
  });

  it('should keep a reminder that already ends in a newline from gaining a second', () => {
    const body = cloaked({
      model: 'claude-sonnet-4-5',
      system: 'house style\n',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(body).toHaveProperty(
      'messages.0.content.1.text',
      '<system-reminder>\nhouse style\n</system-reminder>',
    );
  });
});

describe('a conversation that opens without a user turn', () => {
  it.each(['claude-opus-5', 'claude-sonnet-4-5'])(
    'should leave the messages of a %s conversation alone',
    (model) => {
      const messages = [{ role: 'assistant', content: 'unprompted' }];
      const body = cloaked({ model, system: 'house style', messages });

      expect(body).toEqual({ model, messages });
    },
  );
});

describe('the leading blocks of the first user turn on a legacy model', () => {
  it('should place the reminder after a turn made entirely of tool results', () => {
    const body = cloaked({
      model: 'claude-sonnet-4-5',
      system: 'house style',
      messages: [
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool_1', content: 'ok' }] },
      ],
    });

    expect(body).toHaveProperty('messages.0.content.1.type', 'tool_result');
    expect(body).toHaveProperty(
      'messages.0.content.2.text',
      '<system-reminder>\nhouse style\n</system-reminder>',
    );
  });

  it('should treat a turn whose content is neither text nor blocks as empty', () => {
    const body = cloaked({
      model: 'claude-sonnet-4-5',
      system: 'house style',
      messages: [{ role: 'user', content: 42 }],
    });

    expect(body).toHaveProperty(
      'messages.0.content.1.text',
      '<system-reminder>\nhouse style\n</system-reminder>',
    );
  });
});
