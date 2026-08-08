import { describe, expect, it } from 'vitest';

import type { AnthropicContentBlock } from './anthropic-wire';
import type { HubContentBlock, HubRequest } from './hub';

import { decodeRequest, encodeRequest } from './anthropic-request';
import { anAnthropicAsk } from './anthropic.testkit';

function decodedBlocks(content: readonly AnthropicContentBlock[]): readonly HubContentBlock[] {
  const decoded = decodeRequest(anAnthropicAsk({ messages: [{ role: 'user', content }] }));

  if ('refusal' in decoded) throw new Error('the Anthropic request was refused');

  return decoded.value.messages[0]?.content ?? [];
}

function encodedBlocks(content: readonly HubContentBlock[]): unknown {
  const hub: HubRequest = {
    messages: [{ role: 'user', content }],
    sampling: { maxOutputTokens: 1024 },
  };

  return encodeRequest(hub).value.messages[0]?.content;
}

describe('a cached Anthropic text block naming how long it keeps', () => {
  it('carries the stated time to live onto the hub breakpoint', () => {
    const blocks = decodedBlocks([
      { type: 'text', text: 'remember this', cache_control: { type: 'ephemeral', ttl: '1h' } },
    ]);

    expect(blocks[0]).toMatchObject({
      type: 'text',
      cacheBreakpoint: { type: 'ephemeral', ttl: '1h' },
    });
  });
});

describe('an Anthropic document whose source names none of its fields', () => {
  it('falls back to a base64 PDF holding no data', () => {
    const blocks = decodedBlocks([{ type: 'document', source: {} }]);

    expect(blocks[0]).toEqual({
      type: 'document',
      source: { type: 'base64', mediaType: 'application/pdf', data: '' },
      filename: 'document.pdf',
    });
  });

  it('refuses a URL source the base64 shape cannot hold', () => {
    const blocks = decodedBlocks([
      { type: 'document', source: { type: 'url', url: 'https://example.com/a.pdf' } },
    ]);

    expect(blocks[0]).toMatchObject({
      source: { type: 'base64', mediaType: 'application/pdf', data: '' },
    });
  });
});

describe('a hub document that lives at a URL', () => {
  it('crosses to Anthropic as a URL document source', () => {
    const encoded = encodedBlocks([
      {
        type: 'document',
        source: { type: 'url', url: 'https://example.com/report.pdf' },
        filename: 'report.pdf',
      },
    ]);

    expect(encoded).toEqual([
      {
        type: 'document',
        source: { type: 'url', url: 'https://example.com/report.pdf' },
        title: 'report.pdf',
      },
    ]);
  });
});
