import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, granting, neverFetches } from './gateway-app.testkit';
import {
  chatRequest,
  runtimeAnswering,
  subscriptionGrant,
  subscriptionModel,
} from './gateway-proxy-subscription.testkit';

const credential = JSON.stringify({
  type: 'antigravity',
  access_token: 'google-access',
  refresh_token: 'google-refresh',
  expired: '2027-01-15T08:00:00.000Z',
  project_id: 'cloud-project',
});

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
    const grants = granting(subscriptionGrant('antigravity', credential));
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
