import { Hono } from 'hono';
import { afterEach, describe, expect, test } from 'vitest';

import type { RunningOrigin } from './gateway-app.testkit';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  aVirtualModel,
  servedOrigin,
} from './gateway-app.testkit';

type SeenAsk = { authorization: string | null; body: unknown };

function aRecordingProvider(): { app: Hono; seen: SeenAsk[] } {
  const seen: SeenAsk[] = [];
  const app = new Hono();

  app.post('/v1/chat/completions', async (c) => {
    const body: unknown = await c.req.json();

    seen.push({ authorization: c.req.header('authorization') ?? null, body });

    return c.json({
      choices: [
        { index: 0, message: { role: 'assistant', content: 'Sunny, 21C.' }, finish_reason: 'stop' },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 8 },
    });
  });

  return { app, seen };
}

let running: RunningOrigin | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

async function askThrough(origin: string, path: string, body: unknown): Promise<Response> {
  const app = createGatewayApp(aGatewayHolding(aVirtualModel()), async () =>
    Promise.resolve(aCredentialedGrant(origin)),
  );

  return app.request(`http://127.0.0.1:8397${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('a request crossing to a live provider origin', () => {
  test('the provider receives it under the real model name, and the answer travels back', async () => {
    const provider = aRecordingProvider();

    running = await servedOrigin(provider.app);

    const answer = await askThrough(running.origin, '/v1/chat/completions', {
      model: 'fast',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(provider.seen.at(0)?.body).toMatchObject({ model: 'gpt-5-mini' });
    expect(provider.seen.at(0)?.authorization).toBe('Bearer sk-live-40d1');
    expect(await answer.json()).toMatchObject({
      choices: [{ message: { content: 'Sunny, 21C.' } }],
    });
  });

  test('an Anthropic caller reaches the same target through the hub', async () => {
    const provider = aRecordingProvider();

    running = await servedOrigin(provider.app);

    const answer = await askThrough(running.origin, '/v1/messages', {
      model: 'fast',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    });

    expect(provider.seen.at(0)?.body).toMatchObject({ model: 'gpt-5-mini' });
    expect(await answer.json()).toEqual({
      content: [{ type: 'text', text: 'Sunny, 21C.' }],
      stopReason: 'end',
      usage: { inputTokens: 12, outputTokens: 8 },
    });
  });

  test('a provider refusal crosses back byte for byte with its status', async () => {
    const provider = new Hono();

    provider.post('/v1/chat/completions', (c) => c.text('upstream burned', 500));
    running = await servedOrigin(provider);

    const answer = await askThrough(running.origin, '/v1/chat/completions', {
      model: 'fast',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(answer.status).toBe(500);
    expect(await answer.text()).toBe('upstream burned');
  });
});
