import { describe, expect, it } from 'vitest';

import { aHubMessage, aHubRequest, aHubTextBlock, aHubThinkingBlock } from './hub.testkit';
import { encodeRequest } from './responses-codec';
import { expectTranslation } from './responses.testkit';

describe('encodeRequest: Codex subscription reasoning crosses to Responses', () => {
  it('replays a valid Codex reasoning signature without replaying its visible summary', () => {
    const signature =
      'gAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const request = aHubRequest({
      messages: [
        aHubMessage({
          role: 'assistant',
          content: [
            aHubThinkingBlock({ text: 'do not replay', signature }),
            aHubTextBlock({ text: 'Visible answer' }),
          ],
        }),
      ],
    });

    const { value } = expectTranslation(encodeRequest(request));

    expect(value.input).toEqual([
      { type: 'reasoning', summary: [], content: null, encrypted_content: signature },
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Visible answer' }],
      },
    ]);
    expect(JSON.stringify(value)).not.toContain('do not replay');
  });
});

describe('encodeRequest: Codex subscription extensions cross to Responses', () => {
  it('carries a web-search server tool, its choice, and priority service', () => {
    const request = aHubRequest({
      serverTools: [
        {
          type: 'web_search',
          name: 'web_search',
          allowedDomains: ['example.com'],
          userLocation: { type: 'approximate', city: 'Istanbul', country: 'TR' },
        },
      ],
      toolChoice: { type: 'web_search' },
      serviceTier: 'priority',
    });

    const { value } = expectTranslation(encodeRequest(request));

    expect(value.tools).toEqual([
      {
        type: 'web_search',
        filters: { allowed_domains: ['example.com'] },
        user_location: { type: 'approximate', city: 'Istanbul', country: 'TR' },
      },
    ]);
    expect(value.tool_choice).toEqual({ type: 'web_search' });
    expect(value.service_tier).toBe('priority');
  });
});
