import type { EngineVirtualModel } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import { createGatewayApp } from './gateway-app';
import {
  aGatewayHolding,
  anOpenGrant,
  aVirtualModel,
  granting,
  neverFetches,
} from './gateway-app.testkit';
import {
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
} from './gateway-proxy-subscription.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';

const IMAGES = 'http://127.0.0.1:8397/v1/images';

function codexImageApp(providerModel: string, answer: () => Response) {
  const model = aVirtualModel({ target: { standing: 'bound', providerModel } });
  const answering = runtimeAnswering(answer);
  const app = createGatewayApp(
    aGatewayHolding(model),
    granting(subscriptionGrant('openai', codexCredential())).grantFor,
    neverFetches,
    answering.runtime,
  );

  return { app, answering };
}

function refusingApp(model: EngineVirtualModel, grant = anOpenGrant()) {
  return createGatewayApp(aGatewayHolding(model), granting(grant).grantFor, neverFetches);
}

function sentTool(answering: ReturnType<typeof runtimeAnswering>): unknown {
  const parsed = parsedJson(answering.sent[0]?.request.body ?? '{}');
  const tools = isJsonObject(parsed) ? parsed['tools'] : undefined;

  return Array.isArray(tools) ? tools[0] : undefined;
}

function responsesStream(events: readonly unknown[]): Response {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

const completedImage = {
  type: 'response.completed',
  response: {
    created_at: 42,
    output: [{ type: 'image_generation_call', result: 'FINAL', output_format: 'png' }],
  },
};

async function imageRequest(app: ReturnType<typeof refusingApp>, path: string, body: unknown) {
  const answer = await app.request(`${IMAGES}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return answer;
}

describe('refusing an image request the gateway cannot serve', () => {
  it('reports an unknown model as missing', async () => {
    const app = refusingApp(aVirtualModel({ id: 'fast' }));
    const answer = await imageRequest(app, '/generations', { model: 'slow', prompt: 'otter' });

    expect(answer.status).toBe(404);
    await expect(answer.json()).resolves.toMatchObject({
      error: { type: 'invalid_request_error', message: 'The model "slow" does not exist.' },
    });
  });

  it('reports a model whose target is not bound', async () => {
    const app = refusingApp(aVirtualModel({ target: { standing: 'removed' } }));
    const answer = await imageRequest(app, '/generations', { model: 'fast', prompt: 'otter' });

    expect(answer.status).toBe(400);
    await expect(answer.json()).resolves.toMatchObject({
      error: { message: 'The image model has no target.' },
    });
  });

  it('reports a bound target that holds no image credential', async () => {
    const app = refusingApp(aVirtualModel());
    const answer = await imageRequest(app, '/generations', { model: 'fast', prompt: 'otter' });

    expect(answer.status).toBe(400);
    await expect(answer.json()).resolves.toMatchObject({
      error: { message: 'The image target has no supported credential.' },
    });
  });
});

describe('editing an image through the Codex Responses tool', () => {
  it('asks the image tool to edit rather than generate', async () => {
    const { app, answering } = codexImageApp('gpt-5.4-mini', () =>
      responsesStream([completedImage]),
    );

    await app.request(`${IMAGES}/edits`, {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', prompt: 'brighten it' }),
    });

    expect(sentTool(answering)).toMatchObject({ type: 'image_generation', action: 'edit' });
  });

  it('names its streamed events after the edit action', async () => {
    const { app } = codexImageApp('gpt-5.4-mini', () => responsesStream([completedImage]));
    const answer = await app.request(`${IMAGES}/edits`, {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', prompt: 'brighten it', stream: true }),
    });
    const body = await answer.text();

    expect(body).toContain('event: image_edit.completed');
    expect(body).toContain('"b64_json":"FINAL"');
    expect(body).not.toContain('image_generation.completed');
  });
});
