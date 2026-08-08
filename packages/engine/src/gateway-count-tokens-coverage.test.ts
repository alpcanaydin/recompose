import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import {
  aGatewayHolding,
  anOpenGrant,
  aVirtualModel,
  granting,
  neverFetches,
} from './gateway-app.testkit';
import {
  antigravityCredential,
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
  subscriptionModel,
} from './gateway-proxy-subscription.testkit';
import { isJsonObject } from './gateway-wire';

async function countedWith(grant: SpendGrant, body: Record<string, unknown>): Promise<Response> {
  const answering = runtimeAnswering(() => Response.json({ input_tokens: 5 }));
  const app = createGatewayApp(
    aGatewayHolding(subscriptionModel),
    granting(grant).grantFor,
    neverFetches,
    answering.runtime,
  );
  const answer = await app.request('http://127.0.0.1:8397/v1/messages/count_tokens', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return answer;
}

function conversation(overrides: Record<string, unknown> = {}) {
  return { model: 'fast', messages: [{ role: 'user', content: 'hello' }], ...overrides };
}

async function refusalOf(answer: Response): Promise<string> {
  const body: unknown = await answer.json();
  const error = isJsonObject(body) ? body['error'] : undefined;
  const message = isJsonObject(error) ? error['message'] : undefined;

  return typeof message === 'string' ? message : '';
}

async function countedTokens(answer: Response): Promise<unknown> {
  const body: unknown = await answer.json();

  return isJsonObject(body) ? body['input_tokens'] : undefined;
}

describe('token counting refuses a gateway that cannot spend', () => {
  test('a gateway without a credential refuses with missing_credential', async () => {
    const answer = await countedWith({ verdict: 'missing-credential' }, conversation());

    expect(answer.status).toBe(502);
    await expect(refusalOf(answer)).resolves.toContain('holds no credential');
  });

  test('a subscription credential that is not readable refuses the count', async () => {
    const grant = subscriptionGrant('anthropic', 'not-a-credential');

    const answer = await countedWith(grant, conversation());

    expect(answer.status).toBe(502);
    await expect(refusalOf(answer)).resolves.toContain('holds no credential');
  });

  test('a request naming no model refuses with unknown_model', async () => {
    const answer = await countedWith(anOpenGrant(), { messages: [] });

    expect(answer.status).toBe(404);
    await expect(refusalOf(answer)).resolves.toContain('""');
  });

  test('a gateway whose target was removed refuses with missing_target', async () => {
    const removed = aVirtualModel({ target: { standing: 'removed' } });
    const app = createGatewayApp(
      aGatewayHolding(removed),
      granting(anOpenGrant()).grantFor,
      neverFetches,
    );

    const answer = await app.request('http://127.0.0.1:8397/v1/messages/count_tokens', {
      method: 'POST',
      body: JSON.stringify(conversation()),
    });

    expect(answer.status).toBe(502);
    await expect(refusalOf(answer)).resolves.toContain('holds no target');
  });
});

describe('token counting a Codex conversation that cannot be translated', () => {
  test('a body carrying no messages field refuses as an empty conversation', async () => {
    const grant = subscriptionGrant('openai', codexCredential());

    const answer = await countedWith(grant, { model: 'fast' });

    expect(answer.status).toBe(400);
    await expect(refusalOf(answer)).resolves.toBe('The request carries no message to translate.');
  });

  test('a body carrying an empty message list refuses as an empty conversation', async () => {
    const grant = subscriptionGrant('openai', codexCredential());

    const answer = await countedWith(grant, conversation({ messages: [] }));

    expect(answer.status).toBe(400);
    await expect(refusalOf(answer)).resolves.toBe('The request carries no message to translate.');
  });
});

describe('token counting a target that spends nothing', () => {
  test('an open target counts the Claude conversation locally', async () => {
    const answer = await countedWith(anOpenGrant(), conversation());

    expect(answer.status).toBe(200);
    await expect(countedTokens(answer)).resolves.toEqual(expect.any(Number));
  });

  test('a provider that dies mid-count refuses with missing_target', async () => {
    const answering = runtimeAnswering(() => Response.json({}));
    const app = createGatewayApp(
      aGatewayHolding(subscriptionModel),
      granting(subscriptionGrant('antigravity', antigravityCredential())).grantFor,
      neverFetches,
      { ...answering.runtime, send: deadProvider },
    );

    const answer = await app.request('http://127.0.0.1:8397/v1/messages/count_tokens', {
      method: 'POST',
      body: JSON.stringify(conversation()),
    });

    expect(answer.status).toBe(502);
    await expect(refusalOf(answer)).resolves.toContain('holds no target');
  });
});

// Helpers

async function deadProvider(): Promise<Response> {
  await Promise.resolve();

  throw new Error('the provider connection died');
}
