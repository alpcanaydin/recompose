import { describe, expect, test } from 'vitest';

import { countClaudeInputTokens, countCodexInputTokens } from './token-count';

describe('CLIProxyAPI-compatible Claude input counting', () => {
  test('excludes multimedia, redacted thinking, and control fields', () => {
    const base = {
      system: 'rules',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    };
    const decorated = {
      ...base,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', data: 'huge-payload' } },
            { type: 'redacted_thinking', data: 'secret-control-data' },
            { type: 'text', text: 'hello' },
          ],
        },
      ],
      max_tokens: 9999,
      stream: true,
    };

    expect(countClaudeInputTokens(decorated)).toBe(countClaudeInputTokens(base));
  });

  test('counts tool declarations, calls, results, and text documents', () => {
    const minimal = { messages: [{ role: 'user', content: 'hello' }] };
    const rich = {
      messages: [
        { role: 'user', content: 'hello' },
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'call_1', name: 'lookup', input: { q: 'docs' } }],
        },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: 'ok' }] },
        {
          role: 'user',
          content: [{ type: 'document', title: 'Guide', source: { type: 'text', data: 'body' } }],
        },
      ],
      tools: [{ name: 'lookup', description: 'Find docs', input_schema: { type: 'object' } }],
    };

    expect(countClaudeInputTokens(rich)).toBeGreaterThan(countClaudeInputTokens(minimal));
  });
});

describe('CLIProxyAPI-compatible Codex input counting', () => {
  test('treats null instructions like empty instructions', () => {
    const input = [
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
    ];

    expect(countCodexInputTokens({ instructions: null, input }, 'gpt-5.4')).toBe(
      countCodexInputTokens({ instructions: '', input }, 'gpt-5.4'),
    );
  });

  test('counts tools and structured output schemas', () => {
    const body = {
      input: [{ type: 'message', content: [{ text: 'hello' }] }],
      tools: [{ name: 'lookup', description: 'Find docs', parameters: { type: 'object' } }],
      text: { format: { name: 'answer', schema: { type: 'object' } } },
    };

    expect(countCodexInputTokens(body, 'gpt-5.4')).toBeGreaterThan(
      countCodexInputTokens({ input: body.input }, 'gpt-5.4'),
    );
  });
});
