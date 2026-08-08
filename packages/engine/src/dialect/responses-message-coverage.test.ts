import { describe, expect, it } from 'vitest';

import { decodeRequest } from './responses-codec';

describe('a Responses message that names how long its cache keeps', () => {
  it('carries the stated time to live onto its last text block', () => {
    const decoded = decodeRequest({
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'remember this' }],
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
    });

    if ('refusal' in decoded) throw new Error('the Responses request was refused');

    expect(decoded.value.messages[0]?.content[0]).toMatchObject({
      type: 'text',
      cacheBreakpoint: { type: 'ephemeral', ttl: '1h' },
    });
  });
});
