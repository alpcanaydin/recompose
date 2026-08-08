import { describe, expect, test } from 'vitest';

import { parsedJson } from '../gateway-wire';
import { claudeCountTokensProviderRequest } from './claude-count-tokens';

const ids = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
};

function countRequest(model: string, system?: unknown) {
  return claudeCountTokensProviderRequest(
    'https://api.anthropic.com',
    {
      model,
      messages: [{ role: 'user', content: 'hello' }],
      tools: [{ name: 'lookup', input_schema: { type: 'object' } }],
      metadata: { user_id: 'remove' },
      context_management: { edits: [] },
      diagnostics: { previous_message_id: 'remove' },
      ...(system === undefined ? {} : { system }),
    },
    'claude-access',
    ids,
  );
}

describe('Claude Code 2.1.220 token-count requests', () => {
  test('uses the native URL, beta profile, and identity headers', () => {
    const request = countRequest('claude-opus-5');
    const headers = new Map(request.headers);

    expect(request.url).toBe('https://api.anthropic.com/v1/messages/count_tokens?beta=true');
    expect(headers.get('anthropic-beta')).toBe(
      'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,context-management-2025-06-27,token-counting-2024-11-01',
    );
    expect(headers.get('X-Claude-Code-Session-Id')).toBe(ids.sessionId);
    expect(headers.has('X-Stainless-Timeout')).toBe(false);
  });

  test('never sends metadata, diagnostics, context management, or a system field', () => {
    const body = parsedJson(countRequest('claude-opus-5', 'caller rules').body);

    expect(body).not.toHaveProperty('metadata');
    expect(body).not.toHaveProperty('diagnostics');
    expect(body).not.toHaveProperty('context_management');
    expect(body).not.toHaveProperty('system');
    expect(body).toHaveProperty('messages.1.role', 'system');
  });

  test('relocates legacy caller system text into the first user message', () => {
    const body = parsedJson(countRequest('claude-sonnet-4-5', 'caller rules').body);

    expect(body).toHaveProperty('messages.0.content.0.type', 'text');
    expect(body).toHaveProperty(
      'messages.0.content.0.text',
      '<system-reminder>\ncaller rules\n</system-reminder>',
    );
  });

  test('keeps reversible MCP tool aliases on the count endpoint', () => {
    const request = countRequest('claude-opus-5');

    expect(request.body).toMatch(/"name":"mcp__/u);
    expect(Object.values(request.reverseToolNames ?? {})).toContain('lookup');
  });
});
