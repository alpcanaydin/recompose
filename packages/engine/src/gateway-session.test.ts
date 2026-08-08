import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { requestReplayScopeId, requestSessionId } from './gateway-session';

async function sessionFrom(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const app = new Hono();

  app.post('/', (c) => c.json({ session: requestSessionId(c, body) ?? null }));

  const response = await app.request('http://local/', { method: 'POST', headers });

  return response.json();
}

async function replayScopeFrom(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const app = new Hono();

  app.post('/', (c) => c.json({ scope: requestReplayScopeId(c, body) ?? null }));

  const response = await app.request('http://local/', { method: 'POST', headers });

  return response.json();
}

describe('downstream execution session identity', () => {
  it('prefers the explicit execution header', async () => {
    await expect(
      sessionFrom(
        { session_id: 'body-session' },
        { 'x-session-id': 'header-session', 'x-claude-code-session-id': 'claude-session' },
      ),
    ).resolves.toEqual({ session: 'header-session' });
  });

  it.each(['session_id', 'sessionId', 'conversation_id', 'prompt_cache_key'])(
    'reads %s from the request body',
    async (field) => {
      await expect(sessionFrom({ [field]: 'body-session' })).resolves.toEqual({
        session: 'body-session',
      });
    },
  );

  it('reads the native Claude metadata session', async () => {
    const userId = JSON.stringify({ device_id: 'device', session_id: 'claude-session' });

    await expect(sessionFrom({ metadata: { user_id: userId } })).resolves.toEqual({
      session: 'claude-session',
    });
  });

  it.each(['has space', 'line\nbreak', 'x'.repeat(257)])(
    'rejects unsafe identity %s',
    async (id) => {
      await expect(sessionFrom({ session_id: id })).resolves.toEqual({ session: null });
    },
  );
});

describe('replay session namespaces', () => {
  it('separates explicit sessions from prompt cache buckets', async () => {
    await expect(replayScopeFrom({ session_id: 'same' })).resolves.toEqual({
      scope: 'responses:same',
    });
    await expect(replayScopeFrom({ prompt_cache_key: 'same' })).resolves.toEqual({
      scope: 'prompt-cache:same',
    });
  });

  it('prefers execution identity over prompt cache identity', async () => {
    await expect(
      replayScopeFrom({ prompt_cache_key: 'cache' }, { 'x-session-id': 'socket' }),
    ).resolves.toEqual({ scope: 'execution:socket' });
  });

  it('separates Claude root and subagent scopes', async () => {
    await expect(
      replayScopeFrom({}, { 'x-claude-code-session-id': 'claude-session' }),
    ).resolves.toEqual({ scope: 'claude:claude-session:agent:main' });
    await expect(
      replayScopeFrom(
        {},
        {
          'x-claude-code-session-id': 'claude-session',
          'x-claude-code-agent-id': 'subagent-1',
        },
      ),
    ).resolves.toEqual({ scope: 'claude:claude-session:agent:subagent-1' });
  });

  it('uses Claude metadata when its session header is absent', async () => {
    const userId = JSON.stringify({ session_id: 'metadata-session' });

    await expect(replayScopeFrom({ metadata: { user_id: userId } })).resolves.toEqual({
      scope: 'claude:metadata-session:agent:main',
    });
  });

  it('TestCodexExecutorReasoningReplaySessionKeyCanonicalizesSessionHeaderAliases', async () => {
    for (const name of ['Session_id', 'session_id', 'Session-Id']) {
      await expect(replayScopeFrom({}, { [name]: 'session-alias' })).resolves.toEqual({
        scope: 'responses:session-alias',
      });
    }
  });

  it('TestCodexExecutorReasoningReplaySessionKeyCanonicalizesWindowHeaderWithPayload', async () => {
    await expect(
      replayScopeFrom({ client_metadata: { 'x-codex-window-id': 'window-1' } }),
    ).resolves.toEqual({ scope: 'window:window-1' });
    await expect(replayScopeFrom({}, { 'x-codex-window-id': 'window-1' })).resolves.toEqual({
      scope: 'window:window-1',
    });
  });
});
