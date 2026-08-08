import { describe, expect, it } from 'vitest';

import type { RequestOf } from './dispatcher';

import { translateRequest } from './dispatcher';

describe('Responses tool history grouping crossing Claude', () => {
  it('should group assistant reasoning, text, calls, and their results into two turns', () => {
    const value = translated({
      input: [
        {
          type: 'reasoning',
          encrypted_content: 'anthropic:sig_1',
          summary: [{ type: 'summary_text', text: 'internal reasoning' }],
        },
        { type: 'message', role: 'assistant', content: 'visible answer' },
        { type: 'function_call', call_id: 'call_first', name: 'read_file', arguments: '{}' },
        { type: 'function_call', call_id: 'call_second', name: 'read_file', arguments: '{}' },
        { type: 'function_call_output', call_id: 'call_first', output: 'first result' },
        { type: 'function_call_output', call_id: 'call_second', output: 'second result' },
      ],
    });

    expect(value.messages.map((message) => message.role)).toEqual(['assistant', 'user']);
    expect(contentTypes(value.messages[0]?.content)).toEqual([
      'thinking',
      'text',
      'tool_use',
      'tool_use',
    ]);
    expect(contentTypes(value.messages[1]?.content)).toEqual(['tool_result', 'tool_result']);
  });
});

describe('Responses message grouping crossing Claude', () => {
  it('should merge consecutive user messages while preserving the first cache boundary', () => {
    const value = translated({
      input: [
        {
          type: 'message',
          role: 'user',
          cache_control: { type: 'ephemeral' },
          content: [{ type: 'input_text', text: 'first' }],
        },
        { type: 'message', role: 'user', content: 'second' },
      ],
    });

    expect(value.messages).toHaveLength(1);
    expect(value.messages[0]?.content).toEqual([
      { type: 'text', text: 'first', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'second' },
    ]);
  });

  it('should keep user and assistant role changes as separate turns', () => {
    const value = translated({
      input: [
        { type: 'message', role: 'user', content: 'first' },
        { type: 'message', role: 'assistant', content: 'answer' },
        { type: 'message', role: 'user', content: 'second' },
      ],
    });

    expect(value.messages.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('should drop an empty user turn and merge the assistant turns around it', () => {
    const value = translated({
      input: [
        { type: 'message', role: 'assistant', content: 'first assistant' },
        { type: 'message', role: 'user', content: '' },
        { type: 'message', role: 'assistant', content: 'second assistant' },
      ],
    });

    expect(value.messages.map((message) => message.role)).toEqual(['assistant']);
    expect(value.messages[0]?.content).toEqual([
      { type: 'text', text: 'first assistant' },
      { type: 'text', text: 'second assistant' },
    ]);
  });
});

function translated(body: RequestOf['responses']) {
  const result = translateRequest('responses', 'anthropic', body);

  if ('outcome' in result || 'refusal' in result) throw new Error('expected translated request');

  return result.value;
}

function contentTypes(content: RequestOf['anthropic']['messages'][number]['content'] | undefined) {
  return content === undefined || typeof content === 'string'
    ? []
    : content.map((block) => block.type);
}
