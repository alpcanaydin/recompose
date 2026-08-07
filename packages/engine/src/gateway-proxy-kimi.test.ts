import { expect, test } from 'vitest';

import type { JsonObject } from './gateway-wire';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';

const grant = {
  verdict: 'resolved',
  providerOrigin: 'https://api.kimi.com/coding',
  spend: { custody: 'credentialed', provider: 'kimi', credential: 'kimi-test-credential' },
} as const;

function requestBody(init: RequestInit | undefined) {
  const parsed = typeof init?.body === 'string' ? parsedJson(init.body) : undefined;

  return isJsonObject(parsed) ? parsed : {};
}

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;

  return input instanceof URL ? input.href : input.url;
}

function kimiApp(providerModel: string, answer: JsonObject) {
  const sent: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchLike: typeof fetch = async (input, init) => {
    sent.push({ url: urlOf(input), init });

    return Promise.resolve(Response.json(answer));
  };
  const model = aVirtualModel({ target: { standing: 'bound', providerModel } });
  const app = createGatewayApp(
    aGatewayHolding(model),
    async () => Promise.resolve(grant),
    fetchLike,
  );

  return { app, sent };
}

const anthropicAnswer = {
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'k2.5',
  content: [{ type: 'text', text: 'hello' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 1, output_tokens: 1 },
};

const chatAnswer = {
  id: 'chatcmpl_1',
  object: 'chat.completion',
  choices: [{ index: 0, message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
};

test('sends Claude requests to Kimi Messages with canonical model semantics', async () => {
  const { app, sent } = kimiApp('kimi-k2.5(max)', anthropicAnswer);

  await app.request('http://127.0.0.1:8397/v1/messages', {
    method: 'POST',
    headers: { 'anthropic-beta': 'client-beta-one,client-beta-two' },
    body: JSON.stringify({
      model: 'fast',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'hello' }],
    }),
  });
  const headers = new Headers(sent[0]?.init?.headers);

  expect(sent[0]?.url).toBe('https://api.kimi.com/coding/v1/messages?beta=true');
  expect(headers.get('authorization')).toBe('Bearer kimi-test-credential');
  expect(headers.get('anthropic-beta')).toContain('client-beta-one');
  expect(headers.get('anthropic-beta')).toContain('oauth-2025-04-20');
  expect(headers.get('anthropic-beta')).toContain('interleaved-thinking-2025-05-14');
  expect(requestBody(sent[0]?.init)).toMatchObject({
    model: 'k2.5',
    output_config: { effort: 'high' },
  });
});

test('sends Chat Completions to Kimi with native thinking fields', async () => {
  const { app, sent } = kimiApp('kimi-k3[1m](medium)', chatAnswer);

  await app.request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', messages: [{ role: 'user', content: 'hello' }] }),
  });

  expect(sent[0]?.url).toBe('https://api.kimi.com/coding/v1/chat/completions');
  expect(requestBody(sent[0]?.init)).toMatchObject({
    model: 'k3',
    thinking: { type: 'enabled', effort: 'medium' },
  });
});
