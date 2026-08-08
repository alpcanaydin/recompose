import { expect, test } from 'vitest';

import { normalizeXAIImageRefs } from './xai-image';

test('rewrites xAI image_url fields recursively without touching chat image parts', () => {
  const normalized = normalizeXAIImageRefs({
    model: 'grok-imagine-image',
    image: { type: 'image_url', image_url: 'https://example.com/a.png' },
    images: [
      { image_url: { url: 'https://example.com/b.png' } },
      { url: 'https://example.com/c.png', image_url: 'https://example.com/ignored.png' },
    ],
    reference_images: [{ image_url: 'https://example.com/d.png' }],
    nested: { image: { image_url: 'https://example.com/e.png' } },
    content: [{ type: 'image_url', image_url: { url: 'https://example.com/keep.png' } }],
  });

  expect(normalized).toEqual({
    model: 'grok-imagine-image',
    image: { type: 'image_url', url: 'https://example.com/a.png' },
    images: [{ url: 'https://example.com/b.png' }, { url: 'https://example.com/c.png' }],
    reference_images: [{ url: 'https://example.com/d.png' }],
    nested: { image: { url: 'https://example.com/e.png' } },
    content: [{ type: 'image_url', image_url: { url: 'https://example.com/keep.png' } }],
  });
});

test('supports xAI image refs under dots, backslashes, and empty JSON keys', () => {
  const normalized = normalizeXAIImageRefs({
    'metadata.with.dot': { image: { image_url: 'https://example.com/dot.png' } },
    'back\\slash': { image: { image_url: 'https://example.com/backslash.png' } },
    '': { image: { image_url: 'https://example.com/empty-key.png' } },
  });

  expect(normalized).toEqual({
    'metadata.with.dot': { image: { url: 'https://example.com/dot.png' } },
    'back\\slash': { image: { url: 'https://example.com/backslash.png' } },
    '': { image: { url: 'https://example.com/empty-key.png' } },
  });
});
