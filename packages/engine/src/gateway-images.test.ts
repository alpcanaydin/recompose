import { expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel, granting, neverFetches } from './gateway-app.testkit';
import {
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
} from './gateway-proxy-subscription.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';
import { CODEX_ORIGINATOR, CODEX_USER_AGENT } from './subscription/codex-request';

function imageApp(answer: () => Response, providerModel = 'codex/gpt-image-1.5') {
  const model = aVirtualModel({ target: { standing: 'bound', providerModel } });
  const grants = granting(subscriptionGrant('openai', codexCredential()));
  const answering = runtimeAnswering(answer);
  const app = createGatewayApp(
    aGatewayHolding(model),
    grants.grantFor,
    neverFetches,
    answering.runtime,
  );

  return { app, answering };
}

function sentBody(body: string | undefined) {
  const parsed = parsedJson(body ?? '{}');

  return isJsonObject(parsed) ? parsed : {};
}

function onlyRequest(answering: ReturnType<typeof runtimeAnswering>) {
  const request = answering.sent[0]?.request;

  if (request === undefined) throw new Error('the image request never reached Codex');

  return request;
}

function responsesStream(events: unknown[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

test('forwards image JSON to the native Codex endpoint with its identity', async () => {
  const upstream = { created: 1_713_833_628, data: [{ b64_json: 'AA==' }] };
  const { app, answering } = imageApp(() => Response.json(upstream));
  const answer = await app.request('http://127.0.0.1:8397/v1/images/generations', {
    method: 'POST',
    headers: {
      version: '0.135.0',
      'x-codex-turn-metadata': '{"turn_id":"turn-1"}',
      'x-client-request-id': 'client-request-1',
    },
    body: JSON.stringify({
      model: 'fast',
      prompt: 'A cute baby sea otter',
      output_format: 'jpeg',
      output_compression: 70,
      extra: { preserve: true },
      stream: false,
    }),
  });
  const request = onlyRequest(answering);

  expect(request.url).toBe('https://chatgpt.com/backend-api/codex/images/generations');
  expect(request.headers).toContainEqual(['Accept', 'application/json']);
  expect(request.headers).toContainEqual([
    'Authorization',
    'Bearer header.eyJleHAiOjE4MDAwMDAwMDB9.signature',
  ]);
  expect(request.headers).toContainEqual(['User-Agent', CODEX_USER_AGENT]);
  expect(request.headers).toContainEqual(['Originator', CODEX_ORIGINATOR]);
  expect(request.headers).toContainEqual(['Version', '0.135.0']);
  expect(request.headers).toContainEqual(['X-Codex-Turn-Metadata', '{"turn_id":"turn-1"}']);
  expect(request.headers).toContainEqual(['X-Client-Request-Id', 'client-request-1']);
  expect(sentBody(request.body)).toMatchObject({
    model: 'gpt-image-1.5',
    output_compression: 70,
    extra: { preserve: true },
  });
  expect(sentBody(request.body)['stream']).toBeUndefined();
  expect(await answer.json()).toEqual(upstream);
});

test('passes native Codex image SSE through unchanged', async () => {
  const stream = [
    'event: image_generation.partial_image',
    'data: {"type":"image_generation.partial_image","b64_json":"AA=="}',
    '',
    'event: image_generation.completed',
    'data: {"type":"image_generation.completed","b64_json":"BB=="}',
    '',
  ].join('\n');
  const { app, answering } = imageApp(
    () => new Response(stream, { headers: { 'content-type': 'text/event-stream' } }),
    'gpt-image-2',
  );
  const answer = await app.request('http://127.0.0.1:8397/v1/images/generations', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', prompt: 'otter', partial_images: 2, stream: true }),
  });

  const request = onlyRequest(answering);

  expect(request.headers).toContainEqual(['Accept', 'text/event-stream']);
  expect(sentBody(request.body)).toMatchObject({
    model: 'gpt-image-2',
    stream: true,
    partial_images: 2,
  });
  expect(await answer.text()).toBe(stream);
});

test('preserves Codex JSON image and mask references', async () => {
  const { app, answering } = imageApp(
    () => Response.json({ data: [{ b64_json: 'AA==' }] }),
    'gpt-image-2',
  );

  await app.request('http://127.0.0.1:8397/v1/images/edits', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      prompt: 'Replace the background',
      images: [{ file_id: 'file-abc123' }],
      mask: { file_id: 'file-mask123' },
      stream: false,
    }),
  });

  const request = onlyRequest(answering);

  expect(sentBody(request.body)).toMatchObject({
    model: 'gpt-image-2',
    images: [{ file_id: 'file-abc123' }],
    mask: { file_id: 'file-mask123' },
  });
  expect(sentBody(request.body)['stream']).toBeUndefined();
});

test('rewrites multipart Codex image files to JSON data URLs', async () => {
  const { app, answering } = imageApp(() => Response.json({ data: [{ b64_json: 'AA==' }] }));
  const form = new FormData();

  form.set('model', 'fast');
  form.set('prompt', 'Create a lovely gift basket');
  form.set('output_format', 'webp');
  form.set('n', '2');
  form.set('stream', 'false');
  form.append('image[]', new File(['png-data'], 'source.png', { type: 'image/png' }));
  form.set('mask', new File(['mask-data'], 'mask.png', { type: 'image/png' }));

  await app.request('http://127.0.0.1:8397/v1/images/edits', { method: 'POST', body: form });

  const body = sentBody(onlyRequest(answering).body);
  const request = onlyRequest(answering);

  expect(request.url).toBe('https://chatgpt.com/backend-api/codex/images/edits');
  expect(request.headers).toContainEqual(['Content-Type', 'application/json']);
  expect(body).toMatchObject({
    model: 'gpt-image-1.5',
    prompt: 'Create a lovely gift basket',
    output_format: 'webp',
    n: 2,
  });
  expect(body).toHaveProperty('images.0.image_url', 'data:image/png;base64,cG5nLWRhdGE=');
  expect(body).toHaveProperty('mask.image_url', 'data:image/png;base64,bWFzay1kYXRh');
  expect(body['stream']).toBeUndefined();
});

test('converts a Codex Responses image call to an Images API response', async () => {
  const completed = {
    type: 'response.completed',
    response: {
      created_at: 555,
      output: [
        {
          type: 'image_generation_call',
          result: 'IMAGE',
          output_format: 'webp',
          revised_prompt: 'A refined otter',
        },
      ],
      tool_usage: { image_gen: { total_tokens: 12 } },
    },
  };
  const { app, answering } = imageApp(() => responsesStream([completed]), 'gpt-5.4-mini');
  const answer = await app.request('http://127.0.0.1:8397/v1/images/generations', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', prompt: 'otter', response_format: 'url' }),
  });
  const request = onlyRequest(answering);

  expect(request.url).toBe('https://chatgpt.com/backend-api/codex/responses');
  expect(sentBody(request.body)).toMatchObject({
    model: 'gpt-5.4-mini',
    stream: true,
    tool_choice: { type: 'image_generation' },
    tools: [{ type: 'image_generation', action: 'generate', model: 'gpt-image-2' }],
  });
  expect(await answer.json()).toEqual({
    created: 555,
    data: [
      {
        url: 'data:image/webp;base64,IMAGE',
        revised_prompt: 'A refined otter',
      },
    ],
    output_format: 'webp',
    usage: { total_tokens: 12 },
  });
});

test('converts Codex Responses partial and completed images to Images SSE', async () => {
  const partial = {
    type: 'response.image_generation_call.partial_image',
    partial_image_b64: 'PARTIAL',
    partial_image_index: 0,
    output_format: 'png',
  };
  const completed = {
    type: 'response.completed',
    response: {
      created_at: 666,
      output: [{ type: 'image_generation_call', result: 'FINAL', output_format: 'png' }],
    },
  };
  const { app } = imageApp(() => responsesStream([partial, completed]), 'gpt-5.4-mini');
  const answer = await app.request('http://127.0.0.1:8397/v1/images/generations', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', prompt: 'otter', stream: true }),
  });
  const body = await answer.text();

  expect(body).toContain('event: image_generation.partial_image');
  expect(body).toContain('"b64_json":"PARTIAL"');
  expect(body).toContain('event: image_generation.completed');
  expect(body).toContain('"b64_json":"FINAL"');
});
