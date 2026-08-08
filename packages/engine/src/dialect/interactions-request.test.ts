import { describe, expect, it } from 'vitest';

import { decodeRequest as decodeAnthropic } from './anthropic-request';
import { encodeRequest as encodeAnthropic } from './anthropic-request-encode';
import { decodeRequest, encodeRequest } from './interactions-codec';

describe('Anthropic requests crossing through Interactions', () => {
  it('should map messages, tools, sampling, and tool choice', () => {
    const decoded = decodeAnthropic({
      model: 'gemini-3.1-flash-lite',
      max_tokens: 1024,
      temperature: 0.2,
      top_p: 0.7,
      stop_sequences: ['END'],
      system: 'Be concise',
      tools: [
        {
          name: 'get_weather',
          description: 'Weather',
          input_schema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'get_weather' },
      messages: [{ role: 'user', content: '今天北京的天气怎么样？' }],
    });

    if ('refusal' in decoded) throw new Error('Anthropic request refused');

    const encoded = encodeRequest(decoded.value).value;

    expect(encoded).toMatchObject({
      system_instruction: 'Be concise',
      input: [{ type: 'user_input', content: [{ type: 'text', text: '今天北京的天气怎么样？' }] }],
      tools: [{ type: 'function', name: 'get_weather' }],
      generation_config: {
        max_output_tokens: 1024,
        temperature: 0.2,
        top_p: 0.7,
        stop_sequences: ['END'],
        tool_choice: { type: 'function', name: 'get_weather' },
      },
    });
    expect(encoded).toHaveProperty('tools.0.parameters.properties.location.type', 'string');
  });
});

describe('Anthropic tool history crossing through Interactions', () => {
  it('should map paired tool calls and results', () => {
    const decoded = decodeAnthropic({
      max_tokens: 64,
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { location: '北京' } },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '晴' }],
        },
      ],
    });

    if ('refusal' in decoded) throw new Error('Anthropic tool history refused');

    expect(encodeRequest(decoded.value).value.input).toEqual([
      {
        type: 'function_call',
        id: 'toolu_1',
        call_id: 'toolu_1',
        name: 'get_weather',
        arguments: { location: '北京' },
      },
      { type: 'function_result', call_id: 'toolu_1', result: '晴' },
    ]);
  });
});

describe('Interactions requests crossing through Anthropic', () => {
  it('should restore text, thinking, function calls, and results', () => {
    const decoded = decodeRequest({
      model: 'claude-opus-5',
      input: [
        { type: 'user_input', content: 'question' },
        { type: 'thought', content: 'consider', signature: 'sig_1' },
        { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: { q: 'x' } },
        { type: 'function_result', call_id: 'call_1', result: 'answer' },
      ],
    });
    const encoded = encodeAnthropic(decoded.value);

    if ('refusal' in encoded) throw new Error('Interactions request refused');

    expect(encoded.value.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'question' }] },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'consider', signature: 'sig_1' },
          { type: 'tool_use', id: 'call_1', name: 'lookup', input: { q: 'x' } },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'call_1',
            content: [{ type: 'text', text: 'answer' }],
          },
        ],
      },
    ]);
  });
});
