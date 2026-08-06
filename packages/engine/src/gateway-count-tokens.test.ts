import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, granting, neverFetches } from './gateway-app.testkit';
import {
  claudeCredential,
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
  subscriptionModel,
} from './gateway-proxy-subscription.testkit';
import { isJsonObject } from './gateway-wire';

function countBody() {
  return {
    model: 'fast',
    system: 'caller rules',
    messages: [{ role: 'user', content: 'hello' }],
  };
}

async function countedBy(provider: 'anthropic' | 'openai') {
  const credential =
    provider === 'anthropic'
      ? claudeCredential('claude-access', 1_800_000_000_000)
      : codexCredential();
  const grants = granting(subscriptionGrant(provider, credential));
  const answering = runtimeAnswering(() => Response.json({ input_tokens: 17 }));
  const app = createGatewayApp(
    aGatewayHolding(subscriptionModel),
    grants.grantFor,
    neverFetches,
    answering.runtime,
  );
  const answer = await app.request('http://127.0.0.1:8397/v1/messages/count_tokens', {
    method: 'POST',
    headers: { 'x-session-id': 'count-session' },
    body: JSON.stringify(countBody()),
  });

  return { answer, answering, grants };
}

describe('token counting through a subscription target', () => {
  test('Anthropic reaches the native count_tokens endpoint', async () => {
    const { answer, answering, grants } = await countedBy('anthropic');

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ input_tokens: 17 });
    expect(grants.asked).toEqual([{ slug: 'codex', virtualModel: 'fast' }]);
    expect(answering.sent).toHaveLength(1);
    expect(answering.sent[0]?.request.url).toBe(
      'https://api.anthropic.com/v1/messages/count_tokens?beta=true',
    );
    expect(answering.sent[0]?.request.headers).toContainEqual([
      'X-Claude-Code-Session-Id',
      'count-session',
    ]);
  });

  test('Codex counts the translated Responses input locally', async () => {
    const { answer, answering } = await countedBy('openai');
    const body: unknown = await answer.json();

    expect(answer.status).toBe(200);
    expect(isJsonObject(body) ? body['input_tokens'] : 0).toEqual(expect.any(Number));
    expect(isJsonObject(body) ? body['input_tokens'] : 0).not.toBe(0);
    expect(answering.sent).toEqual([]);
  });
});
