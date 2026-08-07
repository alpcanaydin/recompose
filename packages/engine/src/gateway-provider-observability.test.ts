import { afterEach, describe, expect, it } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aCredentialedGrant, aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { providerObservability } from './provider/provider-observability';

describe('credentialed provider observability', () => {
  afterEach(() => {
    providerObservability().clear();
  });

  it('should record the normalized request, response metadata, and usage', async () => {
    const fetchLike: typeof fetch = async () =>
      Promise.resolve(
        Response.json(
          {
            candidates: [
              { content: { role: 'model', parts: [{ text: 'selam' }] }, finishReason: 'STOP' },
            ],
            usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
          },
          { headers: { 'x-upstream-request-id': 'gemini-request-1' } },
        ),
      );
    const grant = aCredentialedGrant('https://generativelanguage.googleapis.com', 'gemini');
    const app = createGatewayApp(
      aGatewayHolding(aVirtualModel()),
      async () => Promise.resolve(grant),
      fetchLike,
    );

    const answer = await app.request('http://127.0.0.1:8397/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    await answer.text();
    const record = providerObservability().snapshot()[0];

    expect(record).toMatchObject({
      provider: 'gemini',
      model: 'gpt-5-mini',
      dialect: 'gemini',
      method: 'POST',
      status: 200,
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
      generate: true,
    });
    expect(record?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gpt-5-mini:generateContent',
    );
    expect(record?.responseHeaders.get('x-upstream-request-id')).toBe('gemini-request-1');
    expect(new TextDecoder().decode(record?.body)).toContain('"contents"');
  });
});
