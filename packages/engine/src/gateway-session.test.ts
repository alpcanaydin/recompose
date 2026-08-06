import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { requestSessionId } from './gateway-wire';

async function sessionFrom(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const app = new Hono();

  app.post('/', (c) => c.json({ session: requestSessionId(c, body) ?? null }));

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
