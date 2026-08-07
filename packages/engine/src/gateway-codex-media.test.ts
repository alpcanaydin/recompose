import { expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel, granting, neverFetches } from './gateway-app.testkit';
import {
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
} from './gateway-proxy-subscription.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';

function sentBody(text: string | undefined) {
  const body = parsedJson(text ?? '{}');

  return isJsonObject(body) ? body : {};
}

test('Codex Responses Lite header suppresses image generation and parallel tools', async () => {
  const model = aVirtualModel({
    target: { standing: 'bound', providerModel: 'gpt-5.6-sol' },
  });
  const grants = granting(subscriptionGrant('openai', codexCredential()));
  const answering = runtimeAnswering(() => Response.json({ error: 'stop' }, { status: 400 }));
  const app = createGatewayApp(
    aGatewayHolding(model),
    grants.grantFor,
    neverFetches,
    answering.runtime,
  );

  await app.request('http://127.0.0.1:8397/v1/responses', {
    method: 'POST',
    headers: { 'x-openai-internal-codex-responses-lite': ' TRUE ' },
    body: JSON.stringify({
      model: 'fast',
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'draw a cat' }],
        },
      ],
    }),
  });

  const body = sentBody(answering.sent[0]?.request.body);

  expect(answering.sent).toHaveLength(1);
  expect(body['tools']).toBeUndefined();
  expect(body['parallel_tool_calls']).toBe(false);
});
