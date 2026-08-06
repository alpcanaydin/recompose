import type { MockInstance } from 'vitest';

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  aVirtualModel,
  servedOrigin,
} from './gateway-app.testkit';

const aHubAsk = {
  model: 'fast',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
};

const aChatAsk = { model: 'fast', messages: [{ role: 'user', content: 'hello' }] };

const unreachableMessage =
  'The gateway "Codex" could not reach the target for the virtual model "fast".';

async function aDeadOrigin(): Promise<string> {
  const running = await servedOrigin(new Hono());

  await running.close();

  return running.origin;
}

async function askOver(
  origin: string,
  path: string,
  body: unknown,
  fetchLike: typeof fetch = globalThis.fetch,
): Promise<Response> {
  const app = createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    async () => Promise.resolve(aCredentialedGrant(origin)),
    fetchLike,
  );

  return app.request(`http://127.0.0.1:8397${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const aborting: typeof fetch = async () =>
  Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));

let complaints: MockInstance;

beforeEach(() => {
  complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  complaints.mockRestore();
});

describe('a target the gateway cannot reach', () => {
  test('a refused connection answers the bad-gateway refusal in the Anthropic envelope', async () => {
    const refusal = await askOver(await aDeadOrigin(), '/v1/messages', aHubAsk);

    expect(refusal.status).toBe(502);
    expect(await refusal.json()).toEqual({
      type: 'error',
      error: { type: 'api_error', message: unreachableMessage },
    });
  });

  test('the OpenAI dialect reads the same refusal in its own envelope', async () => {
    const refusal = await askOver(await aDeadOrigin(), '/v1/chat/completions', aChatAsk);

    expect(refusal.status).toBe(502);
    expect(await refusal.json()).toEqual({
      error: {
        message: unreachableMessage,
        type: 'api_error',
        param: null,
        code: 'target_unreachable',
      },
    });
  });

  test('the refusal names the alias and its target on the answer headers', async () => {
    const refusal = await askOver(await aDeadOrigin(), '/v1/messages', aHubAsk);

    expect(refusal.headers.get('x-recompose-virtual-model')).toBe('fast');
    expect(refusal.headers.get('x-recompose-target')).toBe('gpt-5-mini');
  });
});

describe('an outbound fetch the bound aborts', () => {
  test('answers the same typed refusal instead of an untyped failure', async () => {
    const refusal = await askOver('http://127.0.0.1:4242', '/v1/messages', aHubAsk, aborting);

    expect(refusal.status).toBe(502);
    expect(await refusal.json()).toEqual({
      type: 'error',
      error: { type: 'api_error', message: unreachableMessage },
    });
  });

  test('the failure logs with its context, and no credential rides the log or the answer', async () => {
    const refusal = await askOver('http://127.0.0.1:4242', '/v1/messages', aHubAsk, aborting);

    const spoken = JSON.stringify(complaints.mock.calls);

    expect(spoken).toContain('could not reach');
    expect(spoken).not.toContain('sk-live-40d1');
    expect(await refusal.text()).not.toContain('sk-live-40d1');
  });
});
