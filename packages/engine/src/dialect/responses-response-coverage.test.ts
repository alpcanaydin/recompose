import { describe, expect, it } from 'vitest';

import { encodeResponse } from './responses-response';

describe('encoding redacted Claude thinking into a Responses answer', () => {
  it('should carry the redacted data as encrypted reasoning content', () => {
    const encoded = encodeResponse({
      id: 'resp_1',
      content: [{ type: 'redacted_thinking', data: 'opaque-bytes' }],
      stopReason: 'end',
      usage: {},
    });

    expect('value' in encoded ? encoded.value.output : []).toEqual([
      {
        type: 'reasoning',
        id: 'rs_0',
        summary: [],
        content: null,
        encrypted_content: 'claude-redacted-thinking:opaque-bytes',
      },
    ]);
  });
});
