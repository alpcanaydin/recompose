import { expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';

const grant = {
  verdict: 'resolved',
  providerOrigin: 'https://api.x.ai/v1',
  spend: { custody: 'credentialed', provider: 'xai', credential: 'xai-test-credential' },
} as const;

function bodyOf(init: RequestInit | undefined) {
  const parsed = typeof init?.body === 'string' ? parsedJson(init.body) : undefined;

  return isJsonObject(parsed) ? parsed : {};
}

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;

  return input instanceof URL ? input.href : input.url;
}

function completedResponse(): Response {
  const event = {
    type: 'response.completed',
    response: {
      id: 'resp_1',
      status: 'completed',
      model: 'grok-4.3',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'ok' }],
        },
      ],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    },
  };

  return new Response(`data: ${JSON.stringify(event)}\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  });
}

function xaiApp(fetchLike: typeof fetch) {
  const model = aVirtualModel({ target: { standing: 'bound', providerModel: 'grok-4.3' } });

  return createGatewayApp(aGatewayHolding(model), async () => Promise.resolve(grant), fetchLike);
}

function requestBody() {
  return {
    model: 'fast',
    input: [
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'hello' }],
      },
    ],
    tools: [],
    tool_choice: 'auto',
    parallel_tool_calls: true,
  };
}

test('serves xAI through its official Responses endpoint', async () => {
  const sent: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchLike: typeof fetch = async (input, init) => {
    sent.push({ url: urlOf(input), init });

    return Promise.resolve(completedResponse());
  };
  const answer = await xaiApp(fetchLike).request('http://127.0.0.1:8397/v1/responses', {
    method: 'POST',
    headers: { 'x-session-id': 'conv-xai-1' },
    body: JSON.stringify(requestBody()),
  });
  const headers = new Headers(sent[0]?.init?.headers);
  const body = bodyOf(sent[0]?.init);

  expect(sent[0]?.url).toBe('https://api.x.ai/v1/responses');
  expect(headers.get('authorization')).toBe('Bearer xai-test-credential');
  expect(headers.get('x-grok-conv-id')).toBe('conv-xai-1');
  expect(body).toMatchObject({
    model: 'grok-4.3',
    stream: true,
    prompt_cache_key: 'conv-xai-1',
  });
  expect(body['tools']).toBeUndefined();
  expect(body['tool_choice']).toBeUndefined();
  expect(body['parallel_tool_calls']).toBeUndefined();
  expect(await answer.json()).toMatchObject({ status: 'completed', model: 'grok-4.3' });
});

test('preserves xAI free-usage retry metadata downstream', async () => {
  const fetchLike: typeof fetch = async () =>
    Promise.resolve(
      Response.json(
        { code: 'subscription:free-usage-exhausted', error: 'free usage exhausted' },
        { status: 429 },
      ),
    );
  const answer = await xaiApp(fetchLike).request('http://127.0.0.1:8397/v1/responses', {
    method: 'POST',
    body: JSON.stringify(requestBody()),
  });

  expect(answer.status).toBe(429);
  expect(answer.headers.get('retry-after')).toBe('86400');
  expect(await answer.json()).toEqual({
    code: 'subscription:free-usage-exhausted',
    error: 'free usage exhausted',
  });
});

test('sanitizes xAI custom calls and encrypted items before upstream', async () => {
  const sent: RequestInit[] = [];
  const fetchLike: typeof fetch = async (_input, init) => {
    if (init !== undefined) sent.push(init);

    return Promise.resolve(completedResponse());
  };
  const input = [
    { type: 'custom_tool_call', name: 'missing_id', input: 'bad' },
    {
      type: 'custom_tool_call',
      call_id: 'call_1',
      name: 'apply_patch',
      input: 'patch text',
    },
    { type: 'custom_tool_call_output', call_id: 'call_1', output: { ok: true } },
    { type: 'compaction', encrypted_content: 'foreign-replay' },
    {
      type: 'reasoning',
      summary: [{ type: 'summary_text', text: 'kept' }],
      encrypted_content: 'bad',
    },
    { role: 'user', content: 'continue' },
  ];

  await xaiApp(fetchLike).request('http://127.0.0.1:8397/v1/responses', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', input }),
  });

  expect(bodyOf(sent[0])).toMatchObject({
    input: [
      { type: 'function_call', call_id: 'call_1', arguments: '{"input":"patch text"}' },
      { type: 'function_call_output', call_id: 'call_1', output: '{"ok":true}' },
      { type: 'reasoning', summary: [{ type: 'summary_text', text: 'kept' }] },
      { role: 'user', content: 'continue' },
    ],
  });
});
