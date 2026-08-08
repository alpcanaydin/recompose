import { describe, expect, it } from 'vitest';

import type { HubContentBlock, HubRequest } from './hub';

import { encodeRequest } from './anthropic-request';

function encodedBlocks(block: HubContentBlock): unknown {
  const hub: HubRequest = {
    messages: [{ role: 'user', content: [block] }],
    sampling: { maxOutputTokens: 64 },
  };

  return encodeRequest(hub).value.messages[0]?.content;
}

describe('hub media that lives at a URL Anthropic cannot fetch', () => {
  it('sends audio across as the plain URL text', () => {
    const encoded = encodedBlocks({
      type: 'audio',
      source: { type: 'url', url: 'https://example.com/clip.mp3' },
    });

    expect(encoded).toEqual([{ type: 'text', text: 'https://example.com/clip.mp3' }]);
  });

  it('sends video across as the plain URL text', () => {
    const encoded = encodedBlocks({
      type: 'video',
      source: { type: 'url', url: 'https://example.com/clip.mp4' },
    });

    expect(encoded).toEqual([{ type: 'text', text: 'https://example.com/clip.mp4' }]);
  });
});
