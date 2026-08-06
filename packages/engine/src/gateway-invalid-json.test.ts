import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, granting, neverFetches } from './gateway-app.testkit';
import {
  claudeCredential,
  runtimeAnswering,
  subscriptionGrant,
  subscriptionModel,
} from './gateway-proxy-subscription.testkit';

function claudeApp() {
  const grant = subscriptionGrant(
    'anthropic',
    claudeCredential('claude-access', 1_800_000_000_000),
  );
  const answering = runtimeAnswering(() => Response.json({ type: 'message' }));
  const app = createGatewayApp(
    aGatewayHolding(subscriptionModel),
    granting(grant).grantFor,
    neverFetches,
    answering.runtime,
  );

  return { app, answering };
}

describe('invalid JSON request scope', () => {
  test.each([
    ['/v1/messages', 'type'],
    ['/v1/chat/completions', 'error'],
    ['/v1/responses', 'error'],
  ])('%s rejects malformed JSON in its native envelope', async (path, envelope) => {
    const { app } = claudeApp();
    const answer = await app.request(`http://127.0.0.1:8397${path}`, {
      method: 'POST',
      body: '{"model":',
    });
    const body: unknown = await answer.json();

    expect(answer.status).toBe(400);
    expect(body).toHaveProperty(envelope);
  });
});

describe('duplicate JSON request scope', () => {
  test.each([false, true])(
    'rejects duplicate metadata before %s streaming send',
    async (stream) => {
      const { app, answering } = claudeApp();
      const answer = await app.request('http://127.0.0.1:8397/v1/messages', {
        method: 'POST',
        body:
          '{"model":"fast","messages":[{"role":"user","content":"hello"}]' +
          `${stream ? ',"stream":true' : ''},"metadata":{},"metadata":{}}`,
      });

      expect(answer.status).toBe(400);
      expect(await answer.json()).toHaveProperty(
        'error.message',
        'The request body repeats the JSON key "metadata".',
      );
      expect(answering.sent).toEqual([]);
    },
  );

  test('rejects duplicate identity inside encoded metadata user_id', async () => {
    const { app, answering } = claudeApp();
    const user_id = '{"account_uuid":"first","account_uuid":"last"}';
    const answer = await app.request('http://127.0.0.1:8397/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        messages: [{ role: 'user', content: 'hello' }],
        metadata: { user_id },
      }),
    });

    expect(answer.status).toBe(400);
    expect(await answer.json()).toHaveProperty(
      'error.message',
      'The request metadata user_id repeats the JSON key "account_uuid".',
    );
    expect(answering.sent).toEqual([]);
  });
});
