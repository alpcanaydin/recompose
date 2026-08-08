import { describe, expect, test } from 'vitest';

import { ensureClaudeCacheControls } from './claude-cache-control';

const ephemeral = { type: 'ephemeral' };

describe('marking the Claude system prompt for caching', () => {
  test('a plain string system prompt becomes a marked text block', () => {
    expect(ensureClaudeCacheControls({ system: 'be terse' })).toEqual({
      system: [{ type: 'text', text: 'be terse', cache_control: ephemeral }],
    });
  });

  test('the last system block carries the marker', () => {
    const marked = ensureClaudeCacheControls({
      system: [
        { type: 'text', text: 'rules' },
        { type: 'text', text: 'style' },
      ],
    });

    expect(marked).toHaveProperty('system.1.cache_control', ephemeral);
    expect(marked).not.toHaveProperty('system.0.cache_control');
  });

  test('a system prompt already marked keeps the marker where the caller put it', () => {
    const marked = ensureClaudeCacheControls({
      system: [
        { type: 'text', text: 'rules', cache_control: ephemeral },
        { type: 'text', text: 'style' },
      ],
    });

    expect(marked).not.toHaveProperty('system.1.cache_control');
  });

  test('a request without a system prompt gains no system field', () => {
    expect(ensureClaudeCacheControls({ messages: [] })).not.toHaveProperty('system.0');
  });
});

describe('marking Claude tools and conversation turns for caching', () => {
  test('the last tool that loads eagerly carries the marker', () => {
    const marked = ensureClaudeCacheControls({
      tools: [{ name: 'Read' }, { name: 'Write' }, { name: 'Slow', defer_loading: true }],
    });

    expect(marked).toHaveProperty('tools.1.cache_control', ephemeral);
    expect(marked).not.toHaveProperty('tools.2.cache_control');
  });

  test('the second-to-last user turn carries the marker', () => {
    const marked = ensureClaudeCacheControls({
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'answer' },
        { role: 'user', content: 'second' },
      ],
    });

    expect(marked).toHaveProperty('messages.0.content.0.cache_control', ephemeral);
    expect(marked).not.toHaveProperty('messages.2.content.0.cache_control');
  });

  test('a single user turn carries no marker', () => {
    const marked = ensureClaudeCacheControls({
      messages: [{ role: 'user', content: [{ type: 'text', text: 'first' }] }],
    });

    expect(marked).not.toHaveProperty('messages.0.content.0.cache_control');
  });

  test('the caller body is left untouched', () => {
    const body = { system: 'be terse' };

    ensureClaudeCacheControls(body);

    expect(body).toEqual({ system: 'be terse' });
  });
});
