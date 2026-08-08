import { describe, expect, it } from 'vitest';

import { decodeResponse } from './anthropic-response';

describe('decoding a Claude response that carries server-side tool traffic', () => {
  it('should drop the blocks the hub holds no shape for', () => {
    const translated = decodeResponse({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} },
        { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] },
        { type: 'text', text: 'Istanbul is warm today.' },
      ],
      stop_reason: 'end_turn',
    });

    expect(translated.value.content).toEqual([{ type: 'text', text: 'Istanbul is warm today.' }]);
  });
});
