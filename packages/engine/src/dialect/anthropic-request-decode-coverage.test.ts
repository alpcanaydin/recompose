import { describe, expect, it } from 'vitest';

import { decodeRequest } from './anthropic-request';
import { anAnthropicAsk } from './anthropic.testkit';

describe('decodeRequest: a system-role turn becomes a wrapped user reminder', () => {
  it('wraps the text it carries and leaves an image beside it untouched', () => {
    const request = anAnthropicAsk({
      messages: [
        {
          role: 'system',
          content: [
            { type: 'text', text: 'Stay on topic.' },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' },
            },
          ],
        },
      ],
    });

    const decoded = decodeRequest(request);

    expect('value' in decoded && decoded.value.messages[0]).toEqual({
      role: 'user',
      boundary: 'system-reminder',
      content: [
        { type: 'text', text: '<system-reminder>\nStay on topic.\n</system-reminder>' },
        { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: 'aGVsbG8=' } },
      ],
    });
  });
});
