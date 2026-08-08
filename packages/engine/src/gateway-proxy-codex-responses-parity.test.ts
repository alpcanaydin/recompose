import { describe, expect, it } from 'vitest';

import { codexSse, codexSubscriptionApp } from './gateway-proxy-codex-subscription.testkit';

describe('Codex Responses identity crossing the gateway', () => {
  it('should expose the original virtual model on created and in-progress events', async () => {
    const { app } = codexSubscriptionApp(() =>
      codexSse([
        { type: 'response.created', response: { id: 'resp_1', model: 'translated-model' } },
        { type: 'response.in_progress', response: { id: 'resp_1', model: 'translated-model' } },
      ]),
    );
    const answer = await app.request('http://127.0.0.1:8397/v1/responses', {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', stream: true, input: 'hello' }),
    });
    const text = await answer.text();

    expect(text.match(/"model":"fast"/gu)).toHaveLength(2);
    expect(text).not.toContain('translated-model');
  });

  it('should preserve an incomplete non-stream terminal response', async () => {
    const { app } = codexSubscriptionApp(() =>
      codexSse([
        {
          type: 'response.incomplete',
          response: {
            id: 'resp_1',
            status: 'incomplete',
            incomplete_details: { reason: 'max_output_tokens' },
            output: [],
            usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
          },
        },
      ]),
    );
    const answer = await app.request('http://127.0.0.1:8397/v1/responses', {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', input: 'hello' }),
    });

    await expect(answer.json()).resolves.toMatchObject({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
    });
  });
});
