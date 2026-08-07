import { describe, expect, it } from 'vitest';

import { codexPromptCacheKey } from './codex-prompt-cache';
import { codexProviderRequest } from './codex-request';

describe('Codex prompt cache keys for Claude Code callers', () => {
  it('should be deterministic and separate agents and models', () => {
    const body = { model: 'gpt-5.4' };
    const root = codexPromptCacheKey(body, 'claude:session-agents:agent:main', 'session-agents');
    const repeated = codexPromptCacheKey(
      body,
      'claude:session-agents:agent:main',
      'session-agents',
    );
    const child = codexPromptCacheKey(
      body,
      'claude:session-agents:agent:agent-a',
      'session-agents',
    );
    const otherModel = codexPromptCacheKey(
      { model: 'gpt-5.5' },
      'claude:session-agents:agent:main',
      'session-agents',
    );

    expect(repeated).toBe(root);
    expect(child).not.toBe(root);
    expect(otherModel).not.toBe(root);
    expect(root).toMatch(/^[\da-f]{8}-[\da-f]{4}-5[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u);
  });

  it('should preserve the downstream session for non-Claude callers', () => {
    expect(codexPromptCacheKey({ model: 'gpt-5.4' }, 'responses:client', 'client')).toBe('client');
  });

  it('should change the cache key without changing the Codex wire session', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      { model: 'gpt-5.4', input: [] },
      { accessToken: 'codex-access' },
      'wire-session',
      false,
      'agent-scoped-cache',
    );
    const body: unknown = JSON.parse(request.body);

    expect(body).toHaveProperty('prompt_cache_key', 'agent-scoped-cache');
    expect(new Map(request.headers).get('Session_id')).toBe('wire-session');
  });
});
