import { describe, expect, test } from 'vitest';

import { claudeProviderRequest } from './claude-request';
import { codexProviderRequest } from './codex-request';

const ids = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
};

const claudeHeaders: [string, string][] = [
  ['Accept', 'application/json'],
  ['Authorization', 'Bearer claude-access'],
  ['Content-Type', 'application/json'],
  ['User-Agent', 'claude-cli/2.1.220 (external, cli)'],
  ['X-Claude-Code-Session-Id', ids.sessionId],
  ['X-Stainless-Arch', 'arm64'],
  ['X-Stainless-Lang', 'js'],
  ['X-Stainless-OS', 'MacOS'],
  ['X-Stainless-Package-Version', '0.94.0'],
  ['X-Stainless-Retry-Count', '0'],
  ['X-Stainless-Runtime', 'node'],
  ['X-Stainless-Runtime-Version', 'v26.3.0'],
  ['X-Stainless-Timeout', '600'],
  [
    'anthropic-beta',
    [
      'claude-code-20250219',
      'oauth-2025-04-20',
      'interleaved-thinking-2025-05-14',
      'redact-thinking-2026-02-12',
      'thinking-token-count-2026-05-13',
      'context-management-2025-06-27',
      'prompt-caching-scope-2026-01-05',
      'mid-conversation-system-2026-04-07',
      'effort-2025-11-24',
      'fallback-credit-2026-06-01',
      'extended-cache-ttl-2025-04-11',
    ].join(','),
  ],
  ['anthropic-dangerous-direct-browser-access', 'true'],
  ['anthropic-version', '2023-06-01'],
  ['x-app', 'cli'],
  ['x-client-request-id', ids.requestId],
  ['Connection', 'keep-alive'],
  ['Accept-Encoding', 'gzip, deflate, br, zstd'],
];

const codexHeaders: [string, string][] = [
  ['Content-Type', 'application/json'],
  ['Authorization', 'Bearer codex-access'],
  ['User-Agent', 'codex-tui/0.146.0 (Mac OS 26.5.0; arm64) iTerm.app/3.6.10 (codex-tui; 0.146.0)'],
  ['Session_id', ids.sessionId],
  ['Accept', 'text/event-stream'],
  ['Connection', 'Keep-Alive'],
  ['Originator', 'codex-tui'],
  ['Chatgpt-Account-Id', 'acct-work'],
];

describe('the request sent as Claude Code 2.1.220', () => {
  test('the first-party Messages URL, body, and ordered wire headers match Claude Code', () => {
    const request = claudeProviderRequest(
      'https://api.anthropic.com',
      { model: 'claude-sonnet-4-5', max_tokens: 256, messages: [], stream: true },
      'claude-access',
      ids,
    );

    expect(request.url).toBe('https://api.anthropic.com/v1/messages?beta=true');
    expect(JSON.parse(request.body)).toEqual({
      model: 'claude-sonnet-4-5',
      max_tokens: 256,
      messages: [],
      stream: true,
    });
    expect(request.headers).toEqual(claudeHeaders);
  });

  test('a request carrying tools declares the advanced-tool-use beta in native order', () => {
    const request = claudeProviderRequest(
      'https://api.anthropic.com',
      {
        model: 'claude-sonnet-4-5',
        max_tokens: 256,
        messages: [],
        tools: [{ name: 'read', input_schema: { type: 'object' } }],
      },
      'claude-access',
      ids,
    );
    const beta = request.headers.find(([name]) => name === 'anthropic-beta')?.[1];

    expect(beta).toContain(
      'mid-conversation-system-2026-04-07,advanced-tool-use-2025-11-20,effort-2025-11-24',
    );
  });
});

describe('the request sent as Codex TUI 0.146.0', () => {
  test('the Codex Responses endpoint receives a streaming request with account identity', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.4',
        instructions: null,
        input: [{ type: 'message', role: 'user', content: 'hello' }],
        store: true,
        previous_response_id: 'resp-old',
        stream_options: { include_usage: true },
      },
      { accessToken: 'codex-access', accountId: 'acct-work' },
      ids.sessionId,
    );

    expect(request.url).toBe('https://chatgpt.com/backend-api/codex/responses');
    expect(JSON.parse(request.body)).toEqual({
      model: 'gpt-5.4',
      instructions: '',
      input: [{ type: 'message', role: 'user', content: 'hello' }],
      store: false,
      stream: true,
      parallel_tool_calls: true,
      include: ['reasoning.encrypted_content'],
    });
    expect(request.headers).toEqual(codexHeaders);
  });

  test('Codex omits the account header when the native bundle carries none', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      { model: 'gpt-5.4', input: [] },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(request.headers.map(([name]) => name)).not.toContain('Chatgpt-Account-Id');
  });
});

describe('normalizing a request for Codex compatibility', () => {
  test('the Codex-required body fields override unsupported client values', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.6',
        stream: 'true',
        store: true,
        parallel_tool_calls: 'false',
        include: ['file_search_call.results', 'reasoning.encrypted_content'],
        max_output_tokens: 4096,
        max_completion_tokens: 4096,
        temperature: 0.2,
        top_p: 0.9,
        service_tier: 'standard',
        truncation: 'auto',
        user: 'request-owner',
        context_management: [{ type: 'compaction', compact_threshold: 12_000 }],
        input: [{ type: 'message', role: 'system', content: 'hello' }],
      },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(JSON.parse(request.body)).toEqual({
      model: 'gpt-5.6',
      stream: true,
      store: false,
      parallel_tool_calls: true,
      include: ['reasoning.encrypted_content'],
      instructions: '',
      input: [{ type: 'message', role: 'developer', content: 'hello' }],
    });
  });
});

describe('normalizing optional Codex request fields', () => {
  test('Codex keeps the only supported service tier', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      { model: 'gpt-5.6', service_tier: 'priority', input: [] },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(JSON.parse(request.body)).toMatchObject({ service_tier: 'priority' });
  });

  test('Codex normalizes string input and web-search aliases', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.6',
        input: 'find current model news',
        tools: [{ type: 'web_search_preview_2025_03_11' }],
        tool_choice: {
          type: 'allowed_tools',
          tools: [{ type: 'web_search_preview' }, { type: 'web_search_preview_2025_03_11' }],
        },
      },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(JSON.parse(request.body)).toMatchObject({
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'find current model news' }],
        },
      ],
      tools: [{ type: 'web_search' }],
      tool_choice: {
        type: 'allowed_tools',
        tools: [{ type: 'web_search' }, { type: 'web_search' }],
      },
    });
  });
});

describe('bounding Codex tool identities', () => {
  test('Codex shortens a long call id consistently across the call and its output', () => {
    const longId = `toolu_${'a'.repeat(62)}`;
    const boundedId = 'toolu_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_6eedd4aa88a6ed2f';
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.6',
        input: [
          { type: 'function_call', call_id: longId, name: 'Bash', arguments: '{}' },
          { type: 'function_call_output', call_id: longId, output: 'ok' },
        ],
      },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(JSON.parse(request.body)).toMatchObject({
      input: [{ call_id: boundedId }, { call_id: boundedId }],
    });
    expect(boundedId).not.toBe(longId);
    expect(boundedId).toHaveLength(64);
  });

  test('Codex gives long tool declarations, choices, and calls the same bounded name', () => {
    const longName = 'mcp__server_with_a_very_long_name_that_exceeds_sixty_four_characters__search';
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.6',
        tools: [{ type: 'function', name: longName, parameters: { type: 'object' } }],
        tool_choice: { type: 'function', name: longName },
        input: [{ type: 'function_call', call_id: 'call_1', name: longName, arguments: '{}' }],
      },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(JSON.parse(request.body)).toMatchObject({
      tools: [{ name: 'mcp__search' }],
      tool_choice: { name: 'mcp__search' },
      input: [{ name: 'mcp__search' }],
    });
  });
});
