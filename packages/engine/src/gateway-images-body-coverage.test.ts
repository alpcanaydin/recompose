import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { readImageBody } from './gateway-images-body';

function imageBodyApp(): Hono {
  const app = new Hono();

  app.post('/', async (context) => context.json(await readImageBody(context)));
  app.onError((error, context) => context.json({ failure: error.message }, 400));

  return app;
}

async function prepared(init: RequestInit): Promise<unknown> {
  const answer = await imageBodyApp().request('http://local/', { method: 'POST', ...init });

  return answer.json();
}

async function preparedJson(body: unknown): Promise<unknown> {
  return prepared({
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type FormEntry = readonly [string, string | File];

async function preparedForm(entries: readonly FormEntry[]): Promise<unknown> {
  const form = new FormData();

  for (const [name, value] of entries) form.set(name, value);

  return prepared({ body: form });
}

describe('Reading a JSON image request', () => {
  it('should strip the streaming flag from a request that does not stream', async () => {
    const body = await preparedJson({ model: 'gpt-image-1.5', prompt: 'a cat', stream: false });

    expect(body).toEqual({
      model: 'gpt-image-1.5',
      body: { model: 'gpt-image-1.5', prompt: 'a cat' },
      stream: false,
    });
  });

  it('should keep the streaming flag on a request that streams', async () => {
    const body = await preparedJson({ model: 'gpt-image-1.5', stream: true });

    expect(body).toEqual({
      model: 'gpt-image-1.5',
      body: { model: 'gpt-image-1.5', stream: true },
      stream: true,
    });
  });

  it('should read a request that names no model as modelless', async () => {
    expect(await preparedJson({ prompt: 'a cat' })).toHaveProperty('model', '');
  });

  it('should read a request whose model is not a name as modelless', async () => {
    expect(await preparedJson({ model: 7 })).toHaveProperty('model', '');
  });

  it('should read a request that declares no content type as JSON', async () => {
    const answer = await imageBodyApp().request('http://local/', {
      method: 'POST',
      body: new TextEncoder().encode('{"model":"gpt-image-1.5"}'),
    });

    await expect(answer.json()).resolves.toHaveProperty('model', 'gpt-image-1.5');
  });
});

describe('Reading a multipart image request', () => {
  it('should read the model and the streaming flag from the form', async () => {
    const body = await preparedForm([
      ['model', 'gpt-image-1.5'],
      ['stream', ' TRUE '],
    ]);

    expect(body).toEqual({ model: 'gpt-image-1.5', body: { stream: true }, stream: true });
  });

  it('should read any other streaming value as not streaming', async () => {
    const body = await preparedForm([
      ['model', 'gpt-image-1.5'],
      ['stream', 'yes'],
    ]);

    expect(body).toEqual({ model: 'gpt-image-1.5', body: {}, stream: false });
  });

  it('should read a form that names no model as modelless', async () => {
    expect(await preparedForm([['prompt', 'a cat']])).toHaveProperty('model', '');
  });

  it('should parse the count fields into numbers', async () => {
    const body = await preparedForm([
      ['n', '3'],
      ['output_compression', '80'],
      ['partial_images', '2'],
    ]);

    expect(body).toHaveProperty('body', { n: 3, output_compression: 80, partial_images: 2 });
  });

  it('should keep a count field that is not a number as it was written', async () => {
    expect(await preparedForm([['n', 'many']])).toHaveProperty('body.n', 'many');
  });

  it('should keep every other field as written text', async () => {
    expect(await preparedForm([['size', '1024x1024']])).toHaveProperty('body.size', '1024x1024');
  });
});

describe('Reading a multipart image mask', () => {
  it('should gather the mask file id into a mask object', async () => {
    expect(await preparedForm([['mask[file_id]', 'file_1']])).toHaveProperty('body.mask', {
      file_id: 'file_1',
    });
  });

  it('should merge the mask URL beside a mask file id already gathered', async () => {
    const body = await preparedForm([
      ['mask[file_id]', 'file_1'],
      ['mask[image_url]', 'https://example.test/mask.png'],
    ]);

    expect(body).toHaveProperty('body.mask', {
      file_id: 'file_1',
      image_url: 'https://example.test/mask.png',
    });
  });

  it('should replace a mask that arrived as plain text with the uploaded mask file', async () => {
    const body = await preparedForm([
      ['mask[file_id]', 'file_1'],
      ['mask', new File(['mask-bytes'], 'mask.png', { type: 'image/png' })],
    ]);

    expect(body).toHaveProperty('body.mask', {
      image_url: 'data:image/png;base64,bWFzay1ieXRlcw==',
    });
  });
});

describe('Reading multipart image uploads', () => {
  it('should type an upload that declares no media type as opaque octets', async () => {
    const body = await preparedForm([['image', new File(['png'], 'a.png')]]);

    expect(body).toHaveProperty('body.images', [
      { image_url: 'data:application/octet-stream;base64,cG5n' },
    ]);
  });

  it('should honour the media type an upload declares', async () => {
    const body = await preparedForm([
      ['image[]', new File(['png'], 'a.png', { type: 'image/png' })],
    ]);

    expect(body).toHaveProperty('body.images', [{ image_url: 'data:image/png;base64,cG5n' }]);
  });
});

describe('Reading a multipart image upload with no media type', () => {
  it('should type an upload whose declared media type is blank as opaque octets', async () => {
    const body = [
      '--xyz',
      'Content-Disposition: form-data; name="image"; filename="a.png"',
      'Content-Type: ',
      '',
      'png',
      '--xyz--',
      '',
    ].join('\r\n');

    const prepare = await prepared({
      headers: { 'content-type': 'multipart/form-data; boundary=xyz' },
      body,
    });

    expect(prepare).toHaveProperty('body.images', [
      { image_url: 'data:application/octet-stream;base64,cG5n' },
    ]);
  });

  it('should discard an uploaded file the images endpoint does not accept', async () => {
    const body = await preparedForm([['avatar', new File(['png'], 'a.png')]]);

    expect(body).toHaveProperty('body', {});
  });

  it('should leave the images list out when the form uploaded none', async () => {
    expect(await preparedForm([['prompt', 'a cat']])).toHaveProperty('body', { prompt: 'a cat' });
  });
});

describe('Refusing an unreadable multipart image request', () => {
  it('should report a multipart body that cannot be parsed', async () => {
    const failure = await prepared({
      headers: { 'content-type': 'multipart/form-data; boundary=xyz' },
      body: 'not really multipart',
    });

    expect(failure).toEqual({ failure: 'The multipart image request could not be read.' });
  });
});
