import { expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';

const grant = {
  verdict: 'resolved',
  providerOrigin: 'https://api.x.ai/v1',
  spend: { custody: 'credentialed', provider: 'xai', credential: 'xai-video-credential' },
} as const;

type Sent = { url: string; init: RequestInit | undefined };

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;

  return input instanceof URL ? input.href : input.url;
}

function bodyOf(init: RequestInit | undefined) {
  const parsed = typeof init?.body === 'string' ? parsedJson(init.body) : undefined;

  return isJsonObject(parsed) ? parsed : undefined;
}

function videoApp(sent: Sent[], answer: unknown = { request_id: 'vid_123' }) {
  const fetchLike: typeof fetch = async (input, init) => {
    sent.push({ url: urlOf(input), init });

    return Promise.resolve(Response.json(answer));
  };
  const model = aVirtualModel({
    target: { standing: 'bound', providerModel: 'grok-imagine-video' },
  });

  return createGatewayApp(aGatewayHolding(model), async () => Promise.resolve(grant), fetchLike);
}

function onlySent(sent: Sent[]): Sent {
  const request = sent[0];

  if (request === undefined) throw new Error('the video request never reached xAI');

  return request;
}

test('creates xAI video jobs with idempotency and native model body', async () => {
  const sent: Sent[] = [];
  const app = videoApp(sent);
  const answer = await app.request('http://127.0.0.1:8397/v1/videos/generations', {
    method: 'POST',
    headers: { 'x-idempotency-key': 'idem-123' },
    body: JSON.stringify({ model: 'fast', prompt: 'animate', duration: 4 }),
  });
  const request = onlySent(sent);
  const headers = new Headers(request.init?.headers);

  expect(request.url).toBe('https://api.x.ai/v1/videos/generations');
  expect(request.init?.method).toBe('POST');
  expect(headers.get('authorization')).toBe('Bearer xai-video-credential');
  expect(headers.get('x-idempotency-key')).toBe('idem-123');
  expect(bodyOf(request.init)).toEqual({
    model: 'grok-imagine-video',
    prompt: 'animate',
    duration: 4,
  });
  expect(await answer.json()).toEqual({ request_id: 'vid_123' });
});

test('retrieves xAI video jobs with an escaped request ID and no body', async () => {
  const sent: Sent[] = [];
  const upstream = {
    status: 'done',
    video: { url: 'https://vidgen.x.ai/video.mp4', duration: 6 },
    model: 'grok-imagine-video',
    progress: 100,
  };
  const app = videoApp(sent, upstream);
  const answer = await app.request('http://127.0.0.1:8397/v1/videos', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', request_id: 'vid/a b' }),
  });
  const request = onlySent(sent);

  expect(request.url).toBe('https://api.x.ai/v1/videos/vid%2Fa%20b');
  expect(request.init?.method).toBe('GET');
  expect(request.init?.body).toBeUndefined();
  expect(await answer.json()).toEqual(upstream);
});

test.each([
  ['/v1/videos/generations', '/videos/generations'],
  ['/v1/videos/edits', '/videos/edits'],
  ['/v1/videos/extensions', '/videos/extensions'],
])('maps %s to the native xAI endpoint', async (route, endpoint) => {
  const sent: Sent[] = [];
  const app = videoApp(sent);

  await app.request(`http://127.0.0.1:8397${route}`, {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', prompt: 'animate' }),
  });
  const request = onlySent(sent);

  expect(request.url).toBe(`https://api.x.ai/v1${endpoint}`);
  expect(request.init?.method).toBe('POST');
});
