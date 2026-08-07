import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import {
  aGatewayHolding,
  aVirtualModel,
  bodySentIn,
  fetchAnsweringWith,
  headersSentIn,
} from './gateway-app.testkit';

const model = aVirtualModel({
  target: { standing: 'bound', providerModel: 'gemini-2.5-pro' },
});

function vertexGrant(credential: string): SpendGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://aiplatform.googleapis.com',
    spend: { custody: 'credentialed', provider: 'vertex', credential },
  };
}

function geminiAnswer(): Response {
  return Response.json({
    candidates: [{ content: { role: 'model', parts: [{ text: 'hello' }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
  });
}

function appFor(credential: string, fetchLike: typeof fetch) {
  return createGatewayApp(
    aGatewayHolding(model),
    async () => Promise.resolve(vertexGrant(credential)),
    fetchLike,
  );
}

async function chat(app: ReturnType<typeof appFor>): Promise<Response> {
  return app.request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      messages: [{ role: 'user', content: 'hello' }],
    }),
  });
}

describe('Vertex API-key serving', () => {
  test('reaches the publisher generateContent endpoint', async () => {
    const upstream = fetchAnsweringWith(geminiAnswer);

    const answer = await chat(appFor('vertex-key', upstream.fetchLike));

    expect(upstream.sent[0]?.url).toBe(
      'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-pro:generateContent',
    );
    expect(headersSentIn(upstream.sent).get('x-goog-api-key')).toBe('vertex-key');
    expect(bodySentIn(upstream.sent)).toMatchObject({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
    });
    expect(await answer.json()).toMatchObject({
      choices: [{ message: { content: 'hello' } }],
    });
  });

  test('honors the credential custom serving base', async () => {
    const upstream = fetchAnsweringWith(geminiAnswer);
    const credential = JSON.stringify({
      api_key: 'vertex-key',
      base_url: 'https://vertex.example/custom/',
    });

    await chat(appFor(credential, upstream.fetchLike));

    expect(upstream.sent[0]?.url).toBe(
      'https://vertex.example/custom/v1/publishers/google/models/gemini-2.5-pro:generateContent',
    );
  });
});

describe('Vertex bearer serving', () => {
  test('reaches the regional project endpoint with bearer authorization', async () => {
    const upstream = fetchAnsweringWith(geminiAnswer);
    const credential = JSON.stringify({
      access_token: 'vertex-token',
      project_id: 'cloud-project',
      location: 'europe-west4',
    });

    await chat(appFor(credential, upstream.fetchLike));

    expect(upstream.sent[0]?.url).toBe(
      'https://europe-west4-aiplatform.googleapis.com/v1/projects/cloud-project/locations/europe-west4/publishers/google/models/gemini-2.5-pro:generateContent',
    );
    expect(headersSentIn(upstream.sent).get('authorization')).toBe('Bearer vertex-token');
  });
});

describe('Vertex Responses tool history', () => {
  test('removes only top-level Gemini tool-call IDs', async () => {
    const upstream = fetchAnsweringWith(geminiAnswer);
    const app = appFor('vertex-key', upstream.fetchLike);

    await app.request('http://127.0.0.1:8397/v1/responses', {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', input: responsesToolHistory() }),
    });

    expect(bodySentIn(upstream.sent)).toMatchObject({
      contents: [
        {
          parts: [{ functionCall: { name: 'lookup', args: { id: 9_007_199_254_740_992 } } }],
        },
        {
          parts: [{ functionResponse: { name: 'call_1', response: { output: '{"id":"keep"}' } } }],
        },
      ],
    });
  });
});

describe('Vertex token counting', () => {
  test('uses native API-key countTokens without inference-only fields', async () => {
    const upstream = fetchAnsweringWith(() => Response.json({ totalTokens: 17 }));

    const answer = await count(appFor('vertex-key', upstream.fetchLike));

    expect(upstream.sent[0]?.url).toBe(
      'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-pro:countTokens',
    );
    expect(headersSentIn(upstream.sent).get('x-goog-api-key')).toBe('vertex-key');
    expect(bodySentIn(upstream.sent)).not.toHaveProperty('tools');
    expect(bodySentIn(upstream.sent)).not.toHaveProperty('generationConfig');
    expect(await answer.json()).toEqual({ input_tokens: 17 });
  });

  test('uses the project countTokens endpoint for bearer credentials', async () => {
    const upstream = fetchAnsweringWith(() => Response.json({ totalTokens: 19 }));
    const credential = JSON.stringify({
      access_token: 'vertex-token',
      project_id: 'cloud-project',
      location: 'global',
    });

    await count(appFor(credential, upstream.fetchLike));

    expect(upstream.sent[0]?.url).toBe(
      'https://aiplatform.googleapis.com/v1/projects/cloud-project/locations/global/publishers/google/models/gemini-2.5-pro:countTokens',
    );
    expect(headersSentIn(upstream.sent).get('authorization')).toBe('Bearer vertex-token');
  });
});

function responsesToolHistory() {
  return [
    {
      type: 'function_call',
      call_id: 'call_1',
      name: 'lookup',
      arguments: '{"id":9007199254740993}',
    },
    { type: 'function_call_output', call_id: 'call_1', output: '{"id":"keep"}' },
  ];
}

async function count(app: ReturnType<typeof appFor>): Promise<Response> {
  return app.request('http://127.0.0.1:8397/v1/messages/count_tokens', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      max_tokens: 64,
      messages: [{ role: 'user', content: 'hello' }],
      tools: [
        {
          name: 'lookup',
          input_schema: { type: 'object', properties: { id: { type: 'integer' } } },
        },
      ],
    }),
  });
}
