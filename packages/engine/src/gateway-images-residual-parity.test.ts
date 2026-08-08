import { Hono } from 'hono';
import { expect, test } from 'vitest';

import { readImageBody } from './gateway-images-body';

test('TestCodexMultipartImageEditAppendsExistingImages', async () => {
  const app = new Hono();

  app.post('/', async (context) => context.json(await readImageBody(context)));

  const form = new FormData();

  form.set('model', 'gpt-image-1.5');
  form.append('images', 'existing-1');
  form.append('images', 'existing-2');
  form.append('image[]', new File(['png-data'], 'source.png'));

  const answer = await app.request('http://local/', { method: 'POST', body: form });

  await expect(answer.json()).resolves.toMatchObject({
    body: {
      images: [
        'existing-1',
        'existing-2',
        { image_url: 'data:application/octet-stream;base64,cG5nLWRhdGE=' },
      ],
    },
  });
});
