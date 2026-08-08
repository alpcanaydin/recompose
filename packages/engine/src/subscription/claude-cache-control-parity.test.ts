import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { ensureClaudeCacheControls } from './claude-cache-control';

function controls(body: JsonObject): string[] {
  return JSON.stringify(body).match(/"cache_control"/gu) ?? [];
}

describe('automatic Claude cache breakpoints', () => {
  test('TestEnsureCacheControl', () => {
    const body = ensureClaudeCacheControls({
      tools: [{ name: 'first' }, { name: 'last' }],
      system: [
        { type: 'text', text: 'one' },
        { type: 'text', text: 'two' },
      ],
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'second' },
        { role: 'assistant', content: 'reply two' },
        { role: 'user', content: 'third' },
      ],
    });

    expect(body).toHaveProperty('tools.1.cache_control.type', 'ephemeral');
    expect(body).toHaveProperty('system.1.cache_control.type', 'ephemeral');
    expect(body).toHaveProperty('messages.2.content.0.cache_control.type', 'ephemeral');
    expect(controls(body)).toHaveLength(3);
  });
});

describe('automatic Claude tool and system cache breakpoints', () => {
  test('TestInjectToolsCacheControlSkipsDeferredTools', () => {
    const trailing = ensureClaudeCacheControls({
      tools: [{ name: 'resident' }, { name: 'deferred', defer_loading: true }],
    });
    const allDeferred = ensureClaudeCacheControls({
      tools: [
        { name: 'one', defer_loading: true },
        { name: 'two', defer_loading: true },
      ],
    });
    const existing = ensureClaudeCacheControls({
      tools: [{ name: 'one', cache_control: { type: 'ephemeral', ttl: '1h' } }, { name: 'two' }],
    });

    expect(trailing).toHaveProperty('tools.0.cache_control.type', 'ephemeral');
    expect(trailing).not.toHaveProperty('tools.1.cache_control');
    expect(allDeferred).not.toHaveProperty('tools.0.cache_control');
    expect(allDeferred).not.toHaveProperty('tools.1.cache_control');
    expect(existing).toHaveProperty('tools.0.cache_control.ttl', '1h');
    expect(existing).not.toHaveProperty('tools.1.cache_control');
  });

  test('TestCacheControlOrder', () => {
    const body = ensureClaudeCacheControls({
      tools: [{ name: 'Read' }, { name: 'Write' }],
      system: [
        { type: 'text', text: 'one' },
        { type: 'text', text: 'two' },
      ],
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(body).not.toHaveProperty('tools.0.cache_control');
    expect(body).toHaveProperty('tools.1.cache_control.type', 'ephemeral');
    expect(body).not.toHaveProperty('system.0.cache_control');
    expect(body).toHaveProperty('system.1.cache_control.type', 'ephemeral');
  });
});
