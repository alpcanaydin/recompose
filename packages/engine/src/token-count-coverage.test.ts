import { describe, expect, test } from 'vitest';

import type { JsonObject } from './gateway-wire';

import { countClaudeInputTokens } from './token-count';

function claude(body: JsonObject): number {
  return countClaudeInputTokens(body);
}

function userSaying(content: unknown): JsonObject {
  return { messages: [{ role: 'user', content }] };
}

function roleOnly(): number {
  return countClaudeInputTokens(userSaying([]));
}

describe('Claude input counting reads every content shape it is given', () => {
  test('a request with nothing to read counts nothing', () => {
    expect(claude({})).toBe(0);
  });

  test('a string content is counted', () => {
    expect(claude(userSaying('hello world'))).toBeGreaterThan(0);
  });

  test('a blank string content adds nothing beyond the role', () => {
    expect(claude(userSaying('   '))).toBe(roleOnly());
  });

  test('a message that is not an object is skipped', () => {
    expect(claude({ messages: ['plain', 42] })).toBe(0);
  });

  test('a messages field that is not a list is skipped', () => {
    expect(claude({ messages: 'hello' })).toBe(0);
  });

  test('a content part of an unknown type falls back to its text', () => {
    expect(claude(userSaying([{ type: 'mystery', text: 'still counted' }]))).toBeGreaterThan(0);
  });

  test('a thinking block is counted', () => {
    expect(claude(userSaying([{ type: 'thinking', thinking: 'considering' }]))).toBeGreaterThan(0);
  });

  test('an image block is skipped', () => {
    expect(claude(userSaying([{ type: 'image', source: { data: 'AAAA' } }]))).toBe(roleOnly());
  });

  test('a redacted thinking block is skipped', () => {
    const part = { type: 'redacted_thinking', data: 'opaque' };

    expect(claude(userSaying([part]))).toBe(roleOnly());
  });
});

describe('Claude input counting reads documents and search results', () => {
  test('a text document is counted with its title and context', () => {
    const part = {
      type: 'document',
      title: 'A gateway',
      context: 'reference',
      source: { type: 'text', data: 'the body', content: 'the rest' },
    };

    expect(claude(userSaying([part]))).toBeGreaterThan(0);
  });

  test('a document whose source is not text is skipped', () => {
    const part = { type: 'document', title: 'A gateway', source: { type: 'base64', data: 'AAAA' } };

    expect(claude(userSaying([part]))).toBe(roleOnly());
  });

  test('a document without a source object is skipped', () => {
    const part = { type: 'document', source: 'inline' };

    expect(claude(userSaying([part]))).toBe(roleOnly());
  });

  test('a web search result is counted with its source and url', () => {
    const part = {
      type: 'web_search_result',
      source: 'search',
      title: 'A gateway',
      url: 'https://example.test/a',
      page_age: '2 days',
      content: 'the excerpt',
    };

    expect(claude(userSaying([part]))).toBeGreaterThan(0);
  });

  test('a nested tool result is counted through its content', () => {
    const part = {
      type: 'tool_result',
      tool_use_id: 'call-1',
      content: [{ type: 'text', text: 'the output' }],
    };

    expect(claude(userSaying([part]))).toBeGreaterThan(0);
  });

  test('a server tool use is counted with its input', () => {
    const part = {
      type: 'server_tool_use',
      id: 'call-1',
      name: 'Bash',
      input: { command: 'true' },
    };

    expect(claude(userSaying([part]))).toBeGreaterThan(0);
  });

  test('a tool use whose input is null counts only its identity', () => {
    const part = { type: 'tool_use', id: 'call-1', name: 'Bash', input: null };

    expect(claude(userSaying([part]))).toBeGreaterThan(0);
  });
});

describe('Claude input counting reads the system prompt and tool declarations', () => {
  test('a string system prompt is counted', () => {
    expect(claude({ system: 'be brief' })).toBeGreaterThan(0);
  });

  test('a system prompt given as text blocks is counted', () => {
    expect(claude({ system: [{ type: 'text', text: 'be brief' }] })).toBeGreaterThan(0);
  });

  test('a system block that is not text is skipped', () => {
    expect(claude({ system: [{ type: 'image', source: {} }] })).toBe(0);
  });

  test('tool declarations are counted with their schema', () => {
    const tools = [
      {
        type: 'custom',
        name: 'Bash',
        description: 'run a command',
        input_schema: { type: 'object' },
      },
    ];

    expect(claude({ tools })).toBeGreaterThan(0);
  });

  test('a tool that is not an object is skipped', () => {
    expect(claude({ tools: ['Bash'] })).toBe(0);
  });

  test('a tools field that is not a list is skipped', () => {
    expect(claude({ tools: 'Bash' })).toBe(0);
  });

  test('a tool choice named as a string is counted', () => {
    expect(claude({ tool_choice: 'auto' })).toBeGreaterThan(0);
  });

  test('a tool choice given as an object is counted', () => {
    expect(claude({ tool_choice: { type: 'tool', name: 'Bash' } })).toBeGreaterThan(0);
  });

  test('an absent tool choice counts nothing', () => {
    expect(claude({ tool_choice: undefined })).toBe(0);
  });
});
