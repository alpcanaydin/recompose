import { describe, expect, it } from 'vitest';

import { translateRequest } from './dispatcher';

describe('Chat system-only input crossing Claude', () => {
  it('should preserve the system and add an empty fallback user turn', () => {
    const translated = translateRequest('chat-completions', 'anthropic', {
      messages: [{ role: 'system', content: 'You are helpful.' }],
    });

    expect(translated).toHaveProperty('value.system.0.text', 'You are helpful.');
    expect(translated).toHaveProperty('value.messages', [
      { role: 'user', content: [{ type: 'text', text: '' }] },
    ]);
  });
});

describe('Chat cache controls crossing Claude', () => {
  it('should preserve message-level TTL and let a part-level control win', () => {
    const messageLevel = translateRequest('chat-completions', 'anthropic', {
      messages: [
        {
          role: 'user',
          content: 'cache me',
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
    });
    const partLevel = translateRequest('chat-completions', 'anthropic', {
      messages: [
        {
          role: 'user',
          cache_control: { type: 'ephemeral', ttl: '1h' },
          content: [{ type: 'text', text: 'part cached', cache_control: { type: 'ephemeral' } }],
        },
      ],
    });

    expect(messageLevel).toHaveProperty('value.messages.0.content.0.cache_control', {
      type: 'ephemeral',
      ttl: '1h',
    });
    expect(partLevel).toHaveProperty('value.messages.0.content.0.cache_control', {
      type: 'ephemeral',
    });
  });
});

describe('Chat tool cache controls crossing Claude', () => {
  it('should preserve tool and tool-result cache controls', () => {
    const translated = translateRequest('chat-completions', 'anthropic', {
      messages: [
        {
          role: 'assistant',
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{}' } },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call_1',
          content: 'ok',
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [
        {
          type: 'function',
          function: { name: 'lookup', parameters: { type: 'object' } },
          cache_control: { type: 'ephemeral' },
        },
      ],
    });

    expect(translated).toHaveProperty('value.tools.0.cache_control', { type: 'ephemeral' });
    expect(translated).toHaveProperty('value.messages.1.content.0.cache_control', {
      type: 'ephemeral',
    });
  });
});

describe('Chat developer messages crossing Claude', () => {
  it('should become separate system blocks with cache on the last block', () => {
    const translated = translateRequest('chat-completions', 'anthropic', {
      messages: [
        {
          role: 'developer',
          content: [
            { type: 'text', text: 'D1' },
            { type: 'text', text: 'D2' },
          ],
          cache_control: { type: 'ephemeral' },
        },
        { role: 'user', content: 'Hello' },
      ],
    });

    expect(translated).toHaveProperty('value.system', [
      { type: 'text', text: 'D1' },
      { type: 'text', text: 'D2', cache_control: { type: 'ephemeral' } },
    ]);
  });
});
