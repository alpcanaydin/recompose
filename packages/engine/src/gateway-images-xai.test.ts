import { expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';

const grant = {
  verdict: 'resolved',
  providerOrigin: 'https://api.x.ai/v1',
  spend: { custody: 'credentialed', provider: 'xai', credential: 'xai-image-credential' },
} as const;

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;

  return input instanceof URL ? input.href : input.url;
}

function bodyOf(init: RequestInit | undefined) {
  const parsed = typeof init?.body === 'string' ? parsedJson(init.body) : undefined;

  return isJsonObject(parsed) ? parsed : {};
}

function xaiImageApp(providerModel: string, fetchLike: typeof fetch) {
  const model = aVirtualModel({ target: { standing: 'bound', providerModel } });

  return createGatewayApp(aGatewayHolding(model), async () => Promise.resolve(grant), fetchLike);
}

test('serves xAI image generation through the native media endpoint', async () => {
  const sent: Array<{ url: string; init: RequestInit | undefined }> = [];
  const upstream = { created: 123, data: [{ b64_json: 'AA==' }] };
  const fetchLike: typeof fetch = async (input, init) => {
    sent.push({ url: urlOf(input), init });

    return Promise.resolve(Response.json(upstream));
  };
  const app = xaiImageApp('grok-imagine-image-quality', fetchLike);
  const answer = await app.request('http://127.0.0.1:8397/v1/images/generations', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', prompt: 'draw' }),
  });
  const headers = new Headers(sent[0]?.init?.headers);

  expect(sent[0]?.url).toBe('https://api.x.ai/v1/images/generations');
  expect(headers.get('authorization')).toBe('Bearer xai-image-credential');
  expect(headers.get('accept')).toBe('application/json');
  expect(headers.get('x-xai-token-auth')).toBeNull();
  expect(headers.get('x-grok-client-version')).toBeNull();
  expect(bodyOf(sent[0]?.init)).toEqual({
    model: 'grok-imagine-image-quality',
    prompt: 'draw',
  });
  expect(await answer.json()).toEqual(upstream);
});

test('serves xAI image edits and rewrites image references', async () => {
  const sent: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchLike: typeof fetch = async (input, init) => {
    sent.push({ url: urlOf(input), init });

    return Promise.resolve(
      Response.json({ created: 123, data: [{ url: 'https://x.ai/image.png' }] }),
    );
  };
  const app = xaiImageApp('grok-imagine-image', fetchLike);

  await app.request('http://127.0.0.1:8397/v1/images/edits', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      prompt: 'edit',
      image: { type: 'image_url', image_url: 'https://example.com/a.png' },
    }),
  });

  expect(sent[0]?.url).toBe('https://api.x.ai/v1/images/edits');
  expect(bodyOf(sent[0]?.init)).toEqual({
    model: 'grok-imagine-image',
    prompt: 'edit',
    image: { type: 'image_url', url: 'https://example.com/a.png' },
  });
});
