import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, granting, neverFetches } from './gateway-app.testkit';
import {
  antigravityCredential,
  chatRequest,
  runtimeAnswering,
  subscriptionGrant,
  subscriptionModel,
} from './gateway-proxy-subscription.testkit';

describe('serving an Antigravity subscription target', () => {
  test('Chat Completions crosses through the Antigravity envelope and Gemini answer', async () => {
    const provider = runtimeAnswering(() =>
      Response.json({
        candidates: [
          { content: { role: 'model', parts: [{ text: 'hello back' }] }, finishReason: 'STOP' },
        ],
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
      }),
    );
    const grants = granting(subscriptionGrant('antigravity', antigravityCredential()));
    const app = createGatewayApp(
      aGatewayHolding(subscriptionModel),
      grants.grantFor,
      neverFetches,
      provider.runtime,
    );
    const answer = await chatRequest(app);
    const sent = provider.sent[0];

    expect(sent?.provider).toBe('antigravity');
    expect(sent?.request.url).toBe(
      'https://daily-cloudcode-pa.googleapis.com/v1internal:generateContent',
    );
    expect(JSON.parse(sent?.request.body ?? '{}')).toMatchObject({
      model: 'claude-sonnet-4-5',
      project: 'cloud-project',
      request: {
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
        toolConfig: { functionCallingConfig: { mode: 'VALIDATED' } },
      },
    });
    await expect(answer.json()).resolves.toMatchObject({
      choices: [{ message: { role: 'assistant', content: 'hello back' } }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    });
  });
});

describe('serving Responses through an Antigravity subscription', () => {
  test('preserves OpenAI tools and returns a function call', async () => {
    const provider = runtimeAnswering(() =>
      Response.json({
        responseId: 'antigravity-tool-response',
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ functionCall: { name: 'get_weather', args: { city: 'Tokyo' } } }],
            },
            finishReason: 'STOP',
          },
        ],
      }),
    );
    const answer = await antigravityApp(provider.runtime).request(
      'http://127.0.0.1:8397/v1/responses',
      {
        method: 'POST',
        body: JSON.stringify({
          model: 'fast',
          input: 'Call get_weather for Tokyo.',
          tools: [
            {
              type: 'function',
              name: 'get_weather',
              description: 'Get weather for a city',
              parameters: { type: 'object', properties: { city: { type: 'string' } } },
            },
          ],
          tool_choice: 'required',
        }),
      },
    );

    await expect(answer.json()).resolves.toMatchObject({
      tools: [{ type: 'function', name: 'get_weather' }],
      output: [
        {
          type: 'function_call',
          name: 'get_weather',
          arguments: '{"city":"Tokyo"}',
        },
      ],
    });
  });
});

describe('retrying Antigravity subscription rate limits', () => {
  test('a transient resource exhaustion retries the same target once', async () => {
    let attempts = 0;
    const waits: number[] = [];
    const provider = runtimeAnswering(() => {
      attempts += 1;

      return attempts === 1
        ? Response.json(
            { error: { status: 'RESOURCE_EXHAUSTED', message: 'Resource has been exhausted' } },
            { status: 429 },
          )
        : antigravitySuccess();
    });
    const app = antigravityApp(provider.runtime, async (milliseconds) => {
      await Promise.resolve();
      waits.push(milliseconds);
    });

    const answer = await chatRequest(app);

    expect(answer.status).toBe(200);
    expect(provider.sent).toHaveLength(2);
    expect(waits).toEqual([500]);
  });

  test('explicit quota exhaustion does not retry', async () => {
    const provider = runtimeAnswering(
      () => new Response(reasonBody('QUOTA_EXHAUSTED'), { status: 429 }),
    );
    const app = antigravityApp(provider.runtime);

    const answer = await chatRequest(app);

    expect(answer.status).toBe(429);
    expect(provider.sent).toHaveLength(1);
  });

  test('a longer rate limit exposes Retry-After without retrying', async () => {
    const provider = runtimeAnswering(() => new Response(rateLimitBody('10s'), { status: 429 }));
    const app = antigravityApp(provider.runtime);

    const answer = await chatRequest(app);

    expect(answer.status).toBe(429);
    expect(answer.headers.get('retry-after')).toBe('10');
    expect(provider.sent).toHaveLength(1);
  });
});

// Helpers

function antigravityApp(
  runtime: Parameters<typeof createGatewayApp>[3],
  wait?: (milliseconds: number) => Promise<void>,
) {
  const grants = granting(subscriptionGrant('antigravity', antigravityCredential()));

  return createGatewayApp(
    aGatewayHolding(subscriptionModel),
    grants.grantFor,
    neverFetches,
    runtime === undefined ? undefined : { ...runtime, ...(wait === undefined ? {} : { wait }) },
  );
}

function antigravitySuccess(): Response {
  return Response.json({
    candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
  });
}

function reasonBody(reason: string): string {
  return JSON.stringify({
    error: {
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason,
        },
      ],
    },
  });
}

function rateLimitBody(retryDelay: string): string {
  return JSON.stringify({
    error: {
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason: 'RATE_LIMIT_EXCEEDED',
        },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay },
      ],
    },
  });
}
