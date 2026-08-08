import { beforeEach, expect, test } from 'vitest';

import type { JsonObject } from './gateway-wire';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';
import { clearKimiReplayCache } from './provider/kimi-replay-runtime';
import { providerObservability } from './provider/provider-observability';

const grant = {
  verdict: 'resolved',
  providerOrigin: 'https://api.kimi.com/coding',
  spend: { custody: 'credentialed', provider: 'kimi', credential: 'kimi-test-credential' },
} as const;

const signedContent = [
  { type: 'thinking', thinking: 'full reasoning', signature: 'kimi-signature' },
  { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { path: 'README.md' } },
];

const compactedMessages = [
  { role: 'user', content: 'inspect' },
  {
    role: 'assistant',
    content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { path: 'README.md' } }],
  },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }] },
];

beforeEach(() => {
  clearKimiReplayCache();
  providerObservability().clear();
});

test('TestKimiExecutorCountTokensUsesCanonicalUpstreamModel', async () => {
  const sent: Array<{ url: string; init: RequestInit | undefined }> = [];
  const app = kimiApp(['kimi-k3[1m](high)'], async (input, init) => {
    sent.push({ url: urlOf(input), init });

    await Promise.resolve();

    return Response.json({ input_tokens: 42 });
  });
  const answer = await count(app, 'fast');
  const body = requestBody(sent[0]?.init);
  const headers = new Headers(sent[0]?.init?.headers);

  expect(await answer.json()).toEqual({ input_tokens: 42 });
  expect(sent[0]?.url).toBe('https://api.kimi.com/coding/v1/messages/count_tokens?beta=true');
  expect(body).toMatchObject({ model: 'k3', output_config: { effort: 'high' } });
  expect(headers.get('authorization')).toBe('Bearer kimi-test-credential');
  expect(headers.get('anthropic-beta')).toContain('client-beta');
  expect(headers.get('anthropic-beta')).toContain('oauth-2025-04-20');
});

test('TestKimiExecutorCountTokensInvalidGzipErrorBodyReturnsDecodeMessage', async () => {
  const app = kimiApp(['kimi-k3'], async () =>
    Promise.resolve(
      new Response('not-a-valid-gzip-stream', {
        status: 400,
        headers: { 'content-encoding': 'gzip' },
      }),
    ),
  );
  const answer = await count(app, 'fast');

  expect(answer.status).toBe(400);
  await expect(answer.text()).resolves.toContain('failed to decode error response body');
});

test('TestKimiExecutorClaudeRequestPreservesInternalModelSemantics', async () => {
  const bodies: JsonObject[] = [];
  const app = kimiApp(['kimi-k2.5(max)'], async (_input, init) => {
    bodies.push(requestBody(init));

    await Promise.resolve();

    return Response.json(anthropicAnswer('k2.5'));
  });
  const answer = await ask(app, 'fast', 'caller-a');

  expect(bodies[0]).toMatchObject({ model: 'k2.5', output_config: { effort: 'high' } });
  await expect(answer.json()).resolves.toMatchObject({ model: 'kimi-k2.5(max)' });
});

test('TestKimiExecutorClaudeStreamForwardsAnthropicBetaAndLogsUpstream', async () => {
  const sent: RequestInit[] = [];
  const app = kimiApp(['kimi-k3'], async (_input, init) => {
    sent.push(init ?? {});

    await Promise.resolve();

    return kimiStream('k3');
  });
  const answer = await ask(app, 'fast', 'caller-a', true);
  const text = await answer.text();
  const headers = new Headers(sent[0]?.headers);
  const observation = providerObservability().snapshot()[0];

  expect(text).toContain('"model":"kimi-k3"');
  expect(headers.get('anthropic-beta')).toContain('client-beta');
  expect(headers.get('anthropic-beta')).toContain('interleaved-thinking-2025-05-14');
  expect(observation).toMatchObject({
    provider: 'kimi',
    model: 'kimi-k3',
  });
  expect(observation).not.toHaveProperty('url');
});

test('TestKimiThinkingReplayScopeIsolatesClaudeCodeCallers', async () => {
  const bodies: JsonObject[] = [];
  const responses = [
    Response.json(anthropicAnswer('k3', signedContent)),
    Response.json(anthropicAnswer('k3')),
    Response.json(anthropicAnswer('k3')),
    Response.json(anthropicAnswer('k3')),
  ];
  const app = kimiApp(['kimi-k3', 'kimi-k3-256k'], async (_input, init) => {
    bodies.push(requestBody(init));

    return Promise.resolve(responses.shift() ?? Response.json(anthropicAnswer('k3')));
  });

  await ask(app, 'fast', 'caller-a');
  await ask(app, 'wide', 'caller-b', false, compactedMessages);
  await ask(app, 'wide', 'caller-a', false, compactedMessages);
  await ask(app, 'wide', undefined, false, compactedMessages);

  expect(bodies[1]).not.toHaveProperty('messages.1.content.0.signature');
  expect(bodies[2]).toHaveProperty('messages.1.content.0.signature', 'kimi-signature');
  expect(bodies[3]).not.toHaveProperty('messages.1.content.0.signature');
});

function kimiApp(models: string[], fetchLike: typeof fetch) {
  const virtuals = models.map((providerModel, index) =>
    aVirtualModel({
      id: index === 0 ? 'fast' : 'wide',
      target: { standing: 'bound', providerModel },
    }),
  );

  return createGatewayApp(
    aGatewayHolding(...virtuals),
    async () => Promise.resolve(grant),
    fetchLike,
  );
}

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;

  return input instanceof URL ? input.href : input.url;
}

function requestBody(init: RequestInit | undefined): JsonObject {
  const parsed = typeof init?.body === 'string' ? parsedJson(init.body) : undefined;

  return isJsonObject(parsed) ? parsed : {};
}

function anthropicAnswer(model: string, content: unknown[] = [{ type: 'text', text: 'done' }]) {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: 'end_turn',
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

function kimiStream(model: string): Response {
  const events = [
    { type: 'message_start', message: anthropicAnswer(model, []) },
    { type: 'message_stop' },
  ];
  const body = events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join('');

  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

async function count(app: ReturnType<typeof createGatewayApp>, model: string): Promise<Response> {
  return app.request('http://127.0.0.1:8397/v1/messages/count_tokens', {
    method: 'POST',
    headers: { 'anthropic-beta': 'client-beta' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hello' }] }),
  });
}

async function ask(
  app: ReturnType<typeof createGatewayApp>,
  model: string,
  caller?: string,
  stream = false,
  messages: unknown[] = [{ role: 'user', content: 'hello' }],
): Promise<Response> {
  return app.request('http://127.0.0.1:8397/v1/messages', {
    method: 'POST',
    headers: {
      'anthropic-beta': 'client-beta',
      'x-session-id': 'shared-session',
      ...(caller === undefined ? {} : { authorization: `Bearer ${caller}` }),
    },
    body: JSON.stringify({ model, max_tokens: 32, stream, messages }),
  });
}
