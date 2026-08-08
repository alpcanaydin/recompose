import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, test } from 'vitest';

import type { SentRequest } from './gateway-app.testkit';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  aVirtualModel,
  fetchAnsweringWith,
  granting,
} from './gateway-app.testkit';

const fast = aVirtualModel();
const slow = aVirtualModel({ id: 'slow', displayName: 'Slow', target: { standing: 'removed' } });

function chatBody(model: string): string {
  return JSON.stringify({ model, messages: [{ role: 'user', content: 'hello' }] });
}

function hubBody(model: string): string {
  return JSON.stringify({
    model,
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
  });
}

type Proxied = {
  answer: Response;
  asked: { slug: string; virtualModel: string }[];
  sent: SentRequest[];
};

async function proxied(grant: SpendGrant, path: string, body: string): Promise<Proxied> {
  const grants = granting(grant);
  const { sent, fetchLike } = fetchAnsweringWith(() => Response.json({ choices: [] }));
  const app = createGatewayApp(aGatewayHolding(fast, slow), grants.grantFor, fetchLike);
  const answer = await app.request(`http://127.0.0.1:8397${path}`, { method: 'POST', body });

  return { answer, asked: grants.asked, sent };
}

describe('a request under a name nobody defined', () => {
  test('asks for no grant, and no request leaves the machine', async () => {
    const { answer, asked, sent } = await proxied(
      aCredentialedGrant(),
      '/v1/chat/completions',
      chatBody('ghost'),
    );

    expect(answer.status).toBe(404);
    expect(asked).toEqual([]);
    expect(sent).toEqual([]);
  });
});

describe('a virtual model whose target left the registry', () => {
  test('answers the missing-target 502 from the snapshot, with no grant round trip', async () => {
    const { answer, asked, sent } = await proxied(
      aCredentialedGrant(),
      '/v1/chat/completions',
      chatBody('slow'),
    );

    expect(answer.status).toBe(502);
    expect(await answer.json()).toEqual({
      error: {
        message: 'The gateway "Codex" holds no target for the virtual model "slow".',
        type: 'invalid_request_error',
        param: null,
        code: 'missing_target',
      },
    });
    expect(asked).toEqual([]);
    expect(sent).toEqual([]);
  });

  test('the Anthropic dialect reads the same refusal in its own envelope', async () => {
    const { answer } = await proxied(aCredentialedGrant(), '/v1/messages', hubBody('slow'));

    expect(answer.status).toBe(502);
    expect(await answer.json()).toEqual({
      type: 'error',
      error: {
        type: 'api_error',
        message: 'The gateway "Codex" holds no target for the virtual model "slow".',
      },
    });
  });
});

describe('a grant the parent refuses', () => {
  test('a missing-target grant answers 502 after exactly one ask', async () => {
    const { answer, asked, sent } = await proxied(
      { verdict: 'missing-target' },
      '/v1/chat/completions',
      chatBody('fast'),
    );

    expect(answer.status).toBe(502);
    expect(await answer.json()).toEqual({
      error: {
        message: 'The gateway "Codex" holds no target for the virtual model "fast".',
        type: 'invalid_request_error',
        param: null,
        code: 'missing_target',
      },
    });
    expect(asked).toEqual([{ slug: 'codex', virtualModel: 'fast' }]);
    expect(sent).toEqual([]);
  });

  test('a missing-credential grant answers 502 naming the credential', async () => {
    const { answer, sent } = await proxied(
      { verdict: 'missing-credential' },
      '/v1/messages',
      hubBody('fast'),
    );

    expect(answer.status).toBe(502);
    expect(await answer.json()).toEqual({
      type: 'error',
      error: {
        type: 'api_error',
        message: 'The gateway "Codex" holds no credential for the virtual model "fast".',
      },
    });
    expect(sent).toEqual([]);
  });
});

describe('a bound name on live traffic', () => {
  test('always asks the parent for a spend grant, naming the gateway and the model', async () => {
    const { asked } = await proxied(aCredentialedGrant(), '/v1/chat/completions', chatBody('fast'));

    expect(asked).toEqual([{ slug: 'codex', virtualModel: 'fast' }]);
  });
});

describe('the loopback guard over the proxied paths', () => {
  test('a model request that carries an Origin header is refused before any grant', async () => {
    const grants = granting(aCredentialedGrant());
    const { sent, fetchLike } = fetchAnsweringWith(() => Response.json({ choices: [] }));
    const app = createGatewayApp(aGatewayHolding(fast), grants.grantFor, fetchLike);

    const refusal = await app.request('http://127.0.0.1:8397/v1/chat/completions', {
      method: 'POST',
      body: chatBody('fast'),
      headers: { origin: 'https://web.example' },
    });

    expect(refusal.status).toBe(403);
    expect(grants.asked).toEqual([]);
    expect(sent).toEqual([]);
  });
});
