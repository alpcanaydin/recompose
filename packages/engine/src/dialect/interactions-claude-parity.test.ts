import { describe, expect, it } from 'vitest';

import { decodeRequest, decodeRequestWithCompat } from './anthropic-codec';
import { decodeResponse as decodeAnthropicResponse } from './anthropic-response';
import { encodeResponse as encodeInteractionsResponse } from './interactions-response';

describe('Claude empty thinking crossing Interactions', () => {
  it('should drop empty thinking by default and retain it in compat mode', () => {
    const request = {
      messages: [
        {
          role: 'assistant' as const,
          content: [{ type: 'thinking' as const, thinking: '', signature: '' }],
        },
      ],
    };

    expect(decodeRequest(request)).toHaveProperty('refusal.reason', 'empty-conversation');

    const compat = decodeRequestWithCompat(request);

    if ('refusal' in compat) throw new Error('expected compat translation');

    expect(compat.value.messages[0]?.content[0]).toEqual({
      type: 'thinking',
      text: '',
      signature: '',
    });
  });
});

describe('Claude usage crossing Interactions', () => {
  it('should combine cache counters and preserve thinking tokens', () => {
    const decoded = decodeAnthropicResponse({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 3,
        output_tokens: 2,
        cache_read_input_tokens: 1,
        cache_creation_input_tokens: 4,
        thinking_tokens: 5,
      },
    });
    const encoded = encodeInteractionsResponse(decoded.value).value;

    expect(encoded.usage).toMatchObject({
      input_tokens: 8,
      output_tokens: 2,
      total_tokens: 10,
      cached_tokens: 5,
      total_cached_tokens: 5,
      reasoning_tokens: 5,
      total_thought_tokens: 5,
    });
  });
});
