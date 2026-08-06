import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { claudeProviderRequest } from './claude-request';

const ids = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
};

const nativeBetas = [
  'claude-code-20250219',
  'oauth-2025-04-20',
  ['interleaved', 'thinking', '2025-05-14'].join('-'),
  'redact-thinking-2026-02-12',
  'thinking-token-count-2026-05-13',
  'context-management-2025-06-27',
  'prompt-caching-scope-2026-01-05',
  'mid-conversation-system-2026-04-07',
  'effort-2025-11-24',
  'fallback-credit-2026-06-01',
  'extended-cache-ttl-2025-04-11',
].join(',');

const nativeHeaders: [string, string][] = [
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
  ['anthropic-beta', nativeBetas],
  ['anthropic-dangerous-direct-browser-access', 'true'],
  ['anthropic-version', '2023-06-01'],
  ['x-app', 'cli'],
  ['x-client-request-id', ids.requestId],
  ['Connection', 'keep-alive'],
  ['Accept-Encoding', 'gzip, deflate, br, zstd'],
];

function requestFor(body: JsonObject): ProviderRequest {
  return claudeProviderRequest('https://api.anthropic.com', body, 'claude-access', ids);
}

function bodyOf(request: ProviderRequest): JsonObject {
  const parsed = parsedJson(request.body);

  return isJsonObject(parsed) ? parsed : {};
}

function semanticBodyOf(request: ProviderRequest): JsonObject {
  const body = bodyOf(request);
  const system = objectsIn(body['system']).slice(2);
  const { system: _nativeSystem, ...withoutSystem } = body;

  return system.length === 0 ? withoutSystem : { ...withoutSystem, system };
}

function objectsIn(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isJsonObject) : [];
}

describe('the request sent as Claude Code 2.1.220', () => {
  test('matches the first-party URL, body, and ordered wire headers', () => {
    const request = requestFor({
      model: 'claude-sonnet-4-5',
      max_tokens: 256,
      messages: [],
      stream: true,
    });

    expect(request.url).toBe('https://api.anthropic.com/v1/messages?beta=true');
    expect(semanticBodyOf(request)).toEqual({
      model: 'claude-sonnet-4-5',
      max_tokens: 256,
      messages: [],
      stream: true,
    });
    expect(request.body).toMatch(/x-anthropic-billing-header:.*cch=[a-f\d]{5};/u);
    expect(request.body).toContain("You are Claude Code, Anthropic's official CLI for Claude.");
    expect(request.headers).toEqual(nativeHeaders);
  });

  test('declares advanced tools and allocates a reversible MCP alias', () => {
    const request = requestFor({
      model: 'claude-sonnet-4-5',
      tools: [{ name: 'read', input_schema: { type: 'object' } }],
    });
    const beta = request.headers.find(([name]) => name === 'anthropic-beta')?.[1];

    expect(beta).toContain(
      'mid-conversation-system-2026-04-07,advanced-tool-use-2025-11-20,effort-2025-11-24',
    );
    expect(request.body).toMatch(/"name":"mcp__/u);
    expect(Object.values(request.reverseToolNames ?? {})).toContain('read');
  });
});

describe('Claude sampling compatibility', () => {
  test.each([
    [{ temperature: 0 }, {}],
    [
      { temperature: 0.2, thinking: { type: 'enabled', budget_tokens: 2048 } },
      { thinking: { type: 'enabled', budget_tokens: 2048 } },
    ],
    [{ temperature: 0, top_p: 0.9, top_k: 40 }, { top_k: 40 }],
    [
      { temperature: 0.2, top_p: 0.9, top_k: 40, thinking: { type: 'adaptive' } },
      { thinking: { type: 'adaptive' } },
    ],
  ])('removes unsupported controls', (input, expected) => {
    const request = requestFor({ model: 'claude-sonnet-4-5', messages: [], ...input });

    expect(semanticBodyOf(request)).toEqual({
      model: 'claude-sonnet-4-5',
      messages: [],
      ...expected,
    });
  });

  test.each(['any', 'tool'])('removes thinking for forced tool choice %s', (type) => {
    const tool_choice = { type, ...(type === 'tool' ? { name: 'search' } : {}) };
    const request = requestFor({
      model: 'claude-sonnet-4-5',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'max' },
      tool_choice,
    });

    expect(semanticBodyOf(request)).toEqual({ model: 'claude-sonnet-4-5', tool_choice });
  });
});

describe('Claude cache-control compatibility', () => {
  test('downgrades a one-hour block following a default five-minute block', () => {
    const request = requestFor({
      model: 'claude-sonnet-4-5',
      tools: [{ name: 'first', cache_control: { type: 'ephemeral', ttl: '1h' } }],
      system: [{ type: 'text', text: 'rules', cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello', cache_control: { type: 'ephemeral', ttl: '1h' } },
          ],
        },
      ],
    });
    const body = bodyOf(request);

    expect(request.body).toContain('"ttl":"1h"');
    expect(JSON.stringify(body).match(/"ttl":"1h"/gu)).toHaveLength(1);
  });
});

describe('Claude cache-control breakpoint limit', () => {
  test('keeps four breakpoints while preserving the last tool', () => {
    const cache_control = { type: 'ephemeral' };
    const request = requestFor({
      model: 'claude-sonnet-4-5',
      tools: [
        { name: 'first', cache_control },
        { name: 'last', cache_control },
      ],
      system: [{ type: 'text', text: 'rules', cache_control }],
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'one', cache_control }] },
        { role: 'user', content: [{ type: 'text', text: 'two', cache_control }] },
      ],
    });
    const tools = objectsIn(bodyOf(request)['tools']);

    expect(tools[0]).not.toHaveProperty('cache_control');
    expect(tools[1]).toHaveProperty('cache_control');
    expect(request.body.match(/cache_control/gu)).toHaveLength(4);
  });

  test('also enforces the limit on a tool-only payload', () => {
    const request = requestFor({
      model: 'claude-sonnet-4-5',
      tools: Array.from({ length: 5 }, (_, index) => ({
        name: `tool-${index}`,
        cache_control: { type: 'ephemeral' },
      })),
    });
    const tools = objectsIn(bodyOf(request)['tools']);

    expect(tools[0]).not.toHaveProperty('cache_control');
    expect(tools[4]).toHaveProperty('cache_control');
    expect(request.body.match(/cache_control/gu)).toHaveLength(4);
  });
});

describe('Claude built-in web-search compatibility', () => {
  test('removes ambiguous empty domain lists', () => {
    const request = requestFor({
      model: 'claude-sonnet-4-5',
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          allowed_domains: ['anthropic.com'],
          blocked_domains: [],
          max_uses: 8,
        },
      ],
    });

    expect(objectsIn(bodyOf(request)['tools'])).toEqual([
      {
        type: 'web_search_20250305',
        name: 'web_search',
        allowed_domains: ['anthropic.com'],
        max_uses: 8,
      },
    ]);
  });

  test('preserves custom empty lists and non-empty built-in lists', () => {
    const request = requestFor({
      model: 'claude-sonnet-4-5',
      tools: [
        { type: 'custom', name: 'search', blocked_domains: [] },
        { type: 'web_search_20250305', name: 'web_search', blocked_domains: ['evil.com'] },
      ],
    });
    const tools = objectsIn(bodyOf(request)['tools']);

    expect(tools[0]?.['blocked_domains']).toEqual([]);
    expect(tools[0]?.['name']).toMatch(/^mcp__/u);
    expect(tools[1]).toEqual({
      type: 'web_search_20250305',
      name: 'web_search',
      blocked_domains: ['evil.com'],
    });
  });
});
