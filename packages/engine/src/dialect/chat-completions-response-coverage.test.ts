import { describe, expect, it } from 'vitest';

import type { HubResponse } from './hub';

import { encodeResponse } from './chat-completions-codec';

function encodedImages(hub: HubResponse): unknown {
  const encoded = encodeResponse(hub);

  if ('refusal' in encoded) throw new Error('the hub answer was refused');

  return encoded.value.choices[0]?.message.images;
}

describe('an answer carrying an image that already lives at a URL', () => {
  it('sends the URL across instead of inlining the bytes', () => {
    const images = encodedImages({
      id: 'resp_1',
      content: [{ type: 'image', source: { type: 'url', url: 'https://example.com/a.png' } }],
      stopReason: 'end',
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    expect(images).toEqual([
      { type: 'image_url', image_url: { url: 'https://example.com/a.png' } },
    ]);
  });
});
