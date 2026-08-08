import type { EngineVirtualModel, SpendGrant } from '@recompose/contracts';
import type { Hono } from 'hono';

import { describe, expect, test } from 'vitest';

import type { SentRequest } from './gateway-app.testkit';

import { createGatewayApp } from './gateway-app';
import {
  aGatewayHolding,
  aVirtualModel,
  bodySentIn,
  fetchAnsweringWith,
  granting,
  headersSentIn,
  neverFetches,
} from './gateway-app.testkit';

const xaiGrant: SpendGrant = {
  verdict: 'resolved',
  providerOrigin: 'https://api.x.ai/v1/',
  spend: { custody: 'credentialed', provider: 'xai', credential: 'xai-live-1' },
};

const openGrant: SpendGrant = {
  verdict: 'resolved',
  providerOrigin: 'https://api.x.ai/v1',
  spend: { custody: 'open' },
};

const openaiGrant: SpendGrant = {
  verdict: 'resolved',
  providerOrigin: 'https://api.openai.com/v1',
  spend: { custody: 'credentialed', provider: 'openai', credential: 'sk-live-1' },
};

const boundTarget: EngineVirtualModel['target'] = {
  standing: 'bound',
  providerModel: 'grok-video-1',
};

function servingGateway(grant: SpendGrant): { app: Hono; sent: SentRequest[] } {
  const answering = fetchAnsweringWith(() => Response.json({ id: 'vid_1' }));
  const app = createGatewayApp(
    aGatewayHolding(aVirtualModel({ id: 'clip', target: boundTarget })),
    granting(grant).grantFor,
    answering.fetchLike,
  );

  return { app, sent: answering.sent };
}

function refusedGateway(grant: SpendGrant, target = boundTarget): Hono {
  return createGatewayApp(
    aGatewayHolding(aVirtualModel({ id: 'clip', target })),
    granting(grant).grantFor,
    neverFetches,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function refusalOf(response: Response): Promise<string> {
  const parsed: unknown = await response.json();
  const error = isRecord(parsed) ? parsed['error'] : undefined;
  const message = isRecord(error) ? error['message'] : undefined;

  return typeof message === 'string' ? message : '';
}

function videoPost(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method: 'POST', headers, body: JSON.stringify(body) };
}

const generations = 'http://127.0.0.1:8397/v1/videos/generations';
const bare = 'http://127.0.0.1:8397/v1/videos';

describe('a video request names a servable virtual model', () => {
  test('an unknown model is refused as absent', async () => {
    const app = refusedGateway(xaiGrant);
    const answer = await app.request(generations, videoPost({ model: 'nope', prompt: 'a cat' }));

    expect(answer.status).toBe(404);
    expect(await refusalOf(answer)).toBe('The model "nope" does not exist.');
  });

  test('a body without a model name is refused as an absent empty model', async () => {
    const app = refusedGateway(xaiGrant);
    const answer = await app.request(generations, videoPost({ prompt: 'a cat' }));

    expect(answer.status).toBe(404);
    expect(await refusalOf(answer)).toBe('The model "" does not exist.');
  });

  test('a virtual model whose target was removed is refused as untargeted', async () => {
    const app = refusedGateway(xaiGrant, { standing: 'removed' });
    const answer = await app.request(generations, videoPost({ model: 'clip', prompt: 'a cat' }));

    expect(answer.status).toBe(400);
    expect(await refusalOf(answer)).toBe('The video model has no target.');
  });
});

describe('a video request needs an xAI credential', () => {
  test('an unresolved grant is refused', async () => {
    const app = refusedGateway({ verdict: 'missing-credential' });
    const answer = await app.request(generations, videoPost({ model: 'clip', prompt: 'a cat' }));

    expect(await refusalOf(answer)).toBe('The video target has no xAI credential.');
  });

  test('an open grant carries no credential and is refused', async () => {
    const app = refusedGateway(openGrant);
    const answer = await app.request(generations, videoPost({ model: 'clip', prompt: 'a cat' }));

    expect(await refusalOf(answer)).toBe('The video target has no xAI credential.');
  });

  test('a credential from another provider is refused', async () => {
    const app = refusedGateway(openaiGrant);
    const answer = await app.request(generations, videoPost({ model: 'clip', prompt: 'a cat' }));

    expect(await refusalOf(answer)).toBe('The video target has no xAI credential.');
  });
});

describe('a granted video request reaches xAI', () => {
  test('the virtual model name is replaced by the bound provider model', async () => {
    const { app, sent } = servingGateway(xaiGrant);

    await app.request(generations, videoPost({ model: 'clip', prompt: 'a cat' }));

    expect(sent.at(0)?.url).toBe('https://api.x.ai/v1/videos/generations');
    expect(bodySentIn(sent)).toStrictEqual({ model: 'grok-video-1', prompt: 'a cat' });
  });

  test('an idempotency key from the caller travels with the generation', async () => {
    const { app, sent } = servingGateway(xaiGrant);

    await app.request(
      generations,
      videoPost({ model: 'clip', prompt: 'a cat' }, { 'x-idempotency-key': '  key-1  ' }),
    );

    expect(headersSentIn(sent).get('x-idempotency-key')).toBe('key-1');
    expect(headersSentIn(sent).get('content-type')).toBe('application/json');
  });

  test('a blank idempotency key is not forwarded', async () => {
    const { app, sent } = servingGateway(xaiGrant);

    await app.request(
      generations,
      videoPost({ model: 'clip', prompt: 'a cat' }, { 'x-idempotency-key': '   ' }),
    );

    expect(headersSentIn(sent).get('x-idempotency-key')).toBeNull();
  });

  test('a caller sending no idempotency key forwards none', async () => {
    const { app, sent } = servingGateway(xaiGrant);

    await app.request(generations, videoPost({ model: 'clip', prompt: 'a cat' }));

    expect(headersSentIn(sent).get('x-idempotency-key')).toBeNull();
  });
});

describe('the bare videos path polls or generates', () => {
  test('a request naming a prior job is polled by identifier', async () => {
    const { app, sent } = servingGateway(xaiGrant);

    await app.request(bare, videoPost({ model: 'clip', request_id: ' vid 1 ' }));

    expect(sent.at(0)?.url).toBe('https://api.x.ai/v1/videos/vid%201');
    expect(sent.at(0)?.init?.method).toBe('GET');
    expect(headersSentIn(sent).get('content-type')).toBeNull();
  });

  test('a request with a blank job identifier starts a generation instead', async () => {
    const { app, sent } = servingGateway(xaiGrant);

    await app.request(bare, videoPost({ model: 'clip', request_id: '   ', prompt: 'a cat' }));

    expect(sent.at(0)?.url).toBe('https://api.x.ai/v1/videos/generations');
    expect(sent.at(0)?.init?.method).toBe('POST');
  });

  test('a request with a non-string job identifier starts a generation instead', async () => {
    const { app, sent } = servingGateway(xaiGrant);

    await app.request(bare, videoPost({ model: 'clip', request_id: 7, prompt: 'a cat' }));

    expect(sent.at(0)?.url).toBe('https://api.x.ai/v1/videos/generations');
    expect(sent.at(0)?.init?.method).toBe('POST');
  });

  test('an explicit extensions path is never rewritten into a poll', async () => {
    const { app, sent } = servingGateway(xaiGrant);

    await app.request(
      'http://127.0.0.1:8397/v1/videos/extensions',
      videoPost({ model: 'clip', request_id: 'vid_1' }),
    );

    expect(sent.at(0)?.url).toBe('https://api.x.ai/v1/videos/extensions');
    expect(sent.at(0)?.init?.method).toBe('POST');
  });
});
