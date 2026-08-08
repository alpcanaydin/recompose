import type { EngineVirtualModel, SpendGrant } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel, granting, neverFetches } from './gateway-app.testkit';
import {
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
} from './gateway-proxy-subscription.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';

const anthropicKey: SpendGrant = {
  verdict: 'resolved',
  providerOrigin: 'https://api.anthropic.com',
  spend: {
    custody: 'credentialed',
    provider: 'anthropic',
    credential: 'sk-ant-key',
    accountId: 'acc-anthropic',
  },
};

describe('an image request the gateway cannot serve', () => {
  it('should say the model does not exist when the gateway holds no such model', async () => {
    const answer = await imageRequest(
      '/v1/images/generations',
      { model: 'missing', prompt: 'otter' },
      aVirtualModel({ id: 'fast' }),
    );

    expect(answer.status).toBe(404);
    await expect(answer.json()).resolves.toMatchObject({
      error: { message: 'The model "missing" does not exist.' },
    });
  });

  it('should say the image model has no target when nothing is bound to it', async () => {
    const answer = await imageRequest(
      '/v1/images/generations',
      { model: 'fast', prompt: 'otter' },
      aVirtualModel({ id: 'fast', target: { standing: 'removed' } }),
    );

    expect(answer.status).toBe(400);
    await expect(answer.json()).resolves.toMatchObject({
      error: { message: 'The image model has no target.' },
    });
  });

  it('should refuse an image target whose account cannot make images', async () => {
    const answer = await imageRequest(
      '/v1/images/generations',
      { model: 'fast', prompt: 'otter' },
      aVirtualModel({ id: 'fast', target: { standing: 'bound', providerModel: 'gpt-image-1.5' } }),
      anthropicKey,
    );

    expect(answer.status).toBe(400);
    await expect(answer.json()).resolves.toMatchObject({
      error: { message: 'The image target has no supported credential.' },
    });
  });
});

describe('an image edit request', () => {
  it('should ask the provider to edit rather than generate', async () => {
    const fixture = editFixture(() =>
      Response.json({
        created_at: 1,
        output: [{ type: 'image_generation_call', result: 'EDITED', output_format: 'png' }],
      }),
    );

    await fixture.app.request('http://127.0.0.1:8397/v1/images/edits', {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', prompt: 'add a hat', image: 'AA==' }),
    });

    expect(sentBody(fixture.answering.sent[0]?.request.body)).toMatchObject({
      tools: [{ type: 'image_generation', action: 'edit' }],
    });
  });

  it('should name its streamed events after the edit it performs', async () => {
    const completed = {
      type: 'response.completed',
      response: {
        created_at: 2,
        output: [{ type: 'image_generation_call', result: 'EDITED', output_format: 'png' }],
      },
    };
    const fixture = editFixture(
      () =>
        new Response(`data: ${JSON.stringify(completed)}\n\n`, {
          headers: { 'content-type': 'text/event-stream' },
        }),
    );

    const answer = await fixture.app.request('http://127.0.0.1:8397/v1/images/edits', {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', prompt: 'add a hat', stream: true }),
    });

    await expect(answer.text()).resolves.toContain('event: image_edit.completed');
  });
});

function editFixture(answer: () => Response) {
  const model = aVirtualModel({
    id: 'fast',
    target: { standing: 'bound', providerModel: 'gpt-5.4-mini' },
  });
  const answering = runtimeAnswering(answer);
  const app = createGatewayApp(
    aGatewayHolding(model),
    granting(subscriptionGrant('openai', codexCredential())).grantFor,
    neverFetches,
    answering.runtime,
  );

  return { app, answering };
}

async function imageRequest(
  path: string,
  body: Record<string, unknown>,
  model: EngineVirtualModel,
  grant: SpendGrant = subscriptionGrant('openai', codexCredential()),
): Promise<Response> {
  const app = createGatewayApp(
    aGatewayHolding(model),
    granting(grant).grantFor,
    neverFetches,
    runtimeAnswering(() => Response.json({})).runtime,
  );

  return app.request(`http://127.0.0.1:8397${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function sentBody(body: string | undefined) {
  const parsed = parsedJson(body ?? '{}');

  return isJsonObject(parsed) ? parsed : {};
}
