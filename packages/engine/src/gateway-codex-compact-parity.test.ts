import { expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel, granting, neverFetches } from './gateway-app.testkit';
import {
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
} from './gateway-proxy-subscription.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';

function compactFixture() {
  const model = aVirtualModel({ target: { standing: 'bound', providerModel: 'gpt-5.4' } });
  const grants = granting(subscriptionGrant('openai', codexCredential()));
  const provider = runtimeAnswering(() =>
    Response.json({ id: 'resp_1', object: 'response.compaction', output: [] }),
  );
  const app = createGatewayApp(
    aGatewayHolding(model),
    grants.grantFor,
    neverFetches,
    provider.runtime,
  );

  return { app, model, provider };
}

function onlyRequest(provider: ReturnType<typeof runtimeAnswering>) {
  const request = provider.sent[0]?.request;

  if (request === undefined) throw new Error('compact request did not reach Codex');

  return request;
}

test('TestCodexExecutorCompactAddsDefaultInstructionsWithoutInjectingImageTool', async () => {
  const { app, model, provider } = compactFixture();
  const answer = await app.request('http://127.0.0.1:8397/v1/responses/compact', {
    method: 'POST',
    body: JSON.stringify({
      model: model.id,
      instructions: null,
      input: [
        { type: 'message', role: 'user', content: 'history' },
        { type: 'compaction_trigger' },
      ],
    }),
  });
  const sent = onlyRequest(provider);
  const body = parsedJson(sent.body);

  expect(sent.url).toBe('https://chatgpt.com/backend-api/codex/responses/compact');
  expect(isJsonObject(body) ? body['instructions'] : null).toBe('');
  expect(body).not.toHaveProperty('tools');
  expect(body).toHaveProperty('input.1.type', 'compaction_trigger');
  expect(await answer.json()).toEqual({ id: 'resp_1', object: 'response.compaction', output: [] });
});
