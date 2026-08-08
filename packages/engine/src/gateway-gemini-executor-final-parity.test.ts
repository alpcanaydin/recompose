import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, test } from 'vitest';

import type { JsonObject } from './gateway-wire';

import { createGatewayApp } from './gateway-app';
import {
  aGatewayHolding,
  aVirtualModel,
  bodySentIn,
  fetchAnsweringWith,
  headersSentIn,
} from './gateway-app.testkit';

type PayloadRule = {
  fromProtocol: string;
  params: JsonObject;
};

function credential(
  options: {
    apiRevision?: string;
    defaults?: PayloadRule[];
    overrides?: PayloadRule[];
  } = {},
): string {
  const rules = (values: PayloadRule[] | undefined) =>
    values?.map((rule) => ({
      models: [
        {
          name: 'gemini-3.1-flash-lite',
          protocol: 'interactions',
          fromProtocol: rule.fromProtocol,
        },
      ],
      params: rule.params,
    }));

  return JSON.stringify({
    api_key: 'test-key',
    ...(options.apiRevision === undefined ? {} : { api_revision: options.apiRevision }),
    payload: {
      ...(options.defaults === undefined ? {} : { defaults: rules(options.defaults) }),
      ...(options.overrides === undefined ? {} : { overrides: rules(options.overrides) }),
    },
  });
}

function appFor(providerModel: string, credentialValue = 'test-key') {
  const model = aVirtualModel({ target: { standing: 'bound', providerModel } });
  const grant: SpendGrant = {
    verdict: 'resolved',
    providerOrigin: 'https://generativelanguage.googleapis.com',
    spend: {
      custody: 'credentialed',
      provider: 'gemini-interactions',
      credential: credentialValue,
      accountId: 'acc-interactions',
    },
  };
  const upstream = fetchAnsweringWith(() =>
    Response.json({ id: 'interaction_1', status: 'completed', steps: [] }),
  );
  const app = createGatewayApp(
    aGatewayHolding(model),
    async () => Promise.resolve(grant),
    upstream.fetchLike,
  );

  return { app, model, upstream };
}

async function request(
  fixture: ReturnType<typeof appFor>,
  path: string,
  body: JsonObject,
  headers: Record<string, string> = {},
): Promise<void> {
  await fixture.app.request(`http://127.0.0.1:8397${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('native Gemini Interactions revision policy', () => {
  test('TestGeminiExecutorNativeInteractionsUsesInteractionsEndpoint', async () => {
    const fixture = appFor('agents/test-agent');

    await request(fixture, '/v1/interactions', { agent: fixture.model.id, input: 'hi' });

    expect(fixture.upstream.sent[0]?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
    );
    expect(headersSentIn(fixture.upstream.sent).get('api-revision')).toBe('2026-05-20');
    expect(bodySentIn(fixture.upstream.sent)).not.toHaveProperty('model');
  });

  test('TestGeminiExecutorNativeInteractionsPreservesApiRevision', async () => {
    const fixture = appFor('agents/test-agent', credential({ apiRevision: '2026-06-01' }));

    await request(fixture, '/v1/interactions', { agent: fixture.model.id, input: 'hi' });

    expect(headersSentIn(fixture.upstream.sent).get('api-revision')).toBe('2026-06-01');
  });

  test('TestGeminiExecutorNativeInteractionsRequestApiRevisionDoesNotOverrideAuthHeader', async () => {
    const fixture = appFor('agents/test-agent', credential({ apiRevision: '2026-06-01' }));

    await request(
      fixture,
      '/v1/interactions',
      { agent: fixture.model.id, input: 'hi' },
      { 'api-revision': '2026-07-01', 'x-goog-api-key': 'client-key' },
    );

    const headers = headersSentIn(fixture.upstream.sent);

    expect(headers.get('api-revision')).toBe('2026-06-01');
    expect(headers.get('x-goog-api-key')).toBe('test-key');
  });
});

describe('native Gemini Interactions payload policy', () => {
  test('TestGeminiExecutorNativeInteractionsPayloadRulesUseResponsesFromProtocol', async () => {
    const fixture = appFor(
      'gemini-3.1-flash-lite',
      credential({
        overrides: [
          { fromProtocol: 'openai', params: { 'generation_config.thinking_summaries': 'wrong' } },
          {
            fromProtocol: 'responses',
            params: { 'generation_config.thinking_summaries': 'detailed' },
          },
        ],
      }),
    );

    await request(fixture, '/v1/responses', { model: fixture.model.id, input: 'hi' });

    expect(bodySentIn(fixture.upstream.sent)).toHaveProperty(
      'generation_config.thinking_summaries',
      'detailed',
    );
  });
});

describe('native Gemini Interactions defaults and suffixes', () => {
  test('TestGeminiExecutorNativeInteractionsPayloadDefaultsUseTranslatedOpenAIChatSource', async () => {
    const fixture = appFor(
      'gemini-3.1-flash-lite',
      credential({
        defaults: [
          {
            fromProtocol: 'openai',
            params: {
              'generation_config.temperature': 0.9,
              'generation_config.top_p': 0.8,
            },
          },
        ],
      }),
    );

    await request(fixture, '/v1/chat/completions', {
      model: fixture.model.id,
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
    });
    const body = bodySentIn(fixture.upstream.sent);

    expect(body).toHaveProperty('generation_config.temperature', 0.2);
    expect(body).toHaveProperty('generation_config.top_p', 0.8);
  });

  test('TestGeminiExecutorNativeInteractionsAppliesThinkingSuffix', async () => {
    const fixture = appFor('gemini-3.1-flash-lite(high)');

    await request(fixture, '/v1/interactions', {
      model: fixture.model.id,
      generation_config: { max_output_tokens: 32 },
      input: 'hi',
    });
    const body = bodySentIn(fixture.upstream.sent);

    expect(body).toHaveProperty('model', 'gemini-3.1-flash-lite');
    expect(body).toHaveProperty('generation_config.thinking_level', 'high');
    expect(body).not.toHaveProperty('generation_config.thinking_summaries');
  });
});
