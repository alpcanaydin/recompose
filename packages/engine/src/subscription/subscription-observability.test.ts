import { afterEach, describe, expect, it } from 'vitest';

import { createGatewayApp } from '../gateway-app';
import { aGatewayHolding, neverFetches } from '../gateway-app.testkit';
import {
  chatRequest,
  claudeCredential,
  runtimeAnswering,
  subscriptionGrant,
  subscriptionModel,
} from '../gateway-proxy-subscription.testkit';
import { providerObservability } from '../provider/provider-observability';

describe('subscription provider observability', () => {
  afterEach(() => {
    providerObservability().clear();
  });

  it('should record the exact subscription request and provider usage', async () => {
    const answering = runtimeAnswering(claudeUsageAnswer);
    const grant = subscriptionGrant(
      'anthropic',
      claudeCredential('claude-access', 1_800_000_000_000),
    );
    const app = createGatewayApp(
      aGatewayHolding(subscriptionModel),
      async () => Promise.resolve(grant),
      neverFetches,
      answering.runtime,
    );

    const answer = await chatRequest(app);

    await answer.text();
    const record = providerObservability().snapshot()[0];

    expect(record).toMatchObject({
      provider: 'anthropic',
      accountId: 'acc-anthropic',
      model: 'claude-sonnet-4-5',
      dialect: 'anthropic',
      status: 200,
      usage: {
        inputTokens: 2,
        outputTokens: 3,
        cacheReadTokens: 5,
        cacheWriteTokens: 7,
        totalTokens: 17,
      },
    });
    expect(record?.url).toBe('https://api.anthropic.com/v1/messages?beta=true');
    expect(new TextDecoder().decode(record?.body)).toContain('claude-sonnet-4-5');
  });
});

function claudeUsageAnswer(): Response {
  return Response.json({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'selam' }],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 2,
      output_tokens: 3,
      cache_read_input_tokens: 5,
      cache_creation_input_tokens: 7,
    },
  });
}
