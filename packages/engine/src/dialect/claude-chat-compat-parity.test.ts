import { describe, expect, it } from 'vitest';

import { encodeRequest as encodeAnthropic } from './anthropic-request-encode';
import { decodeRequest, decodeRequestWithCompat } from './chat-completions-request-decode';
import { translateRequest } from './dispatcher';

describe('Chat reasoning content crossing Claude compat', () => {
  it('should drop reasoning by default and preserve it as unsigned thinking in compat mode', () => {
    const request = {
      messages: [{ role: 'assistant' as const, reasoning_content: 'reason', content: 'answer' }],
    };
    const normal = decodeRequest(request);
    const compat = decodeRequestWithCompat(request);

    if ('refusal' in normal || 'refusal' in compat) throw new Error('expected translations');

    expect(JSON.stringify(normal.value)).not.toContain('reason');
    expect(encodeAnthropic(compat.value).value.messages).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'reason', signature: '' },
          { type: 'text', text: 'answer' },
        ],
      },
    ]);
  });
});

describe('Chat compat assistant grouping crossing Claude', () => {
  it('should group thinking, text, and tools in one assistant turn', () => {
    const decoded = decodeRequestWithCompat({
      messages: [
        { role: 'assistant', reasoning_content: 'reason', content: 'answer' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'first', arguments: '{}' } },
            { id: 'call_2', type: 'function', function: { name: 'second', arguments: '{}' } },
          ],
        },
        { role: 'tool', tool_call_id: 'call_1', content: 'one' },
        { role: 'tool', tool_call_id: 'call_2', content: 'two' },
      ],
    });

    if ('refusal' in decoded) throw new Error('expected compat translation');

    expect(encodeAnthropic(decoded.value).value.messages[0]?.content).toEqual([
      { type: 'thinking', thinking: 'reason', signature: '' },
      { type: 'text', text: 'answer' },
      { type: 'tool_use', id: 'call_1', name: 'first', input: {} },
      { type: 'tool_use', id: 'call_2', name: 'second', input: {} },
    ]);
  });
});

describe('Chat sampling crossing Claude', () => {
  it('should drop temperature while preserving top-p', () => {
    const translated = translateRequest('chat-completions', 'anthropic', {
      temperature: 0.2,
      top_p: 0.8,
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(translated).not.toHaveProperty('value.temperature');
    expect(translated).toHaveProperty('value.top_p', 0.8);
  });
});
