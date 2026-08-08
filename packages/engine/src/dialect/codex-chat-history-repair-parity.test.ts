import { describe, expect, it } from 'vitest';

import type { ChatCompletionsRequest } from './chat-completions-wire';
import type { ResponsesRequest } from './responses-wire';

import { translateRequest } from './dispatcher';

describe('Codex missing tool IDs crossing Chat requests', () => {
  it('TestCustomToolCallHistorySynthesizesMissingCallID', () => {
    const value = translated({
      messages: [
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ type: 'custom', custom: { name: 'apply_patch', input: 'patch' } }],
        },
        { role: 'tool', content: 'patched' },
      ],
    });
    const call = value.input.find((item) => item.type === 'custom_tool_call');
    const output = value.input.find((item) => item.type === 'custom_tool_call_output');

    if (call === undefined || output === undefined) throw new Error('expected custom pair');

    expect(call).toMatchObject({ type: 'custom_tool_call' });
    expect(output).toMatchObject({ type: 'custom_tool_call_output' });
    expect(call.call_id).toBe(output.call_id);
  });

  it('TestToolCallOutputWithoutIDUsesPendingCall', () => {
    const value = translated({
      messages: [
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_explicit',
              type: 'function',
              function: { name: 'lookup', arguments: '{}' },
            },
            { type: 'custom', custom: { name: 'apply_patch', input: 'patch' } },
          ],
        },
        { role: 'tool', content: 'found' },
        { role: 'tool', content: 'patched' },
      ],
    });

    expect(value.input.map((item) => item.type)).toEqual([
      'function_call',
      'custom_tool_call',
      'function_call_output',
      'custom_tool_call_output',
    ]);
    expect(value.input[2]).toHaveProperty('call_id', 'call_explicit');
    const customCall = value.input.find((item) => item.type === 'custom_tool_call');

    if (customCall === undefined) throw new Error('expected custom call');
    expect(value.input[3]).toHaveProperty('call_id', customCall.call_id);
  });
});

describe('Codex tool batches crossing Chat requests', () => {
  it('TestToolCallHistoryClearsUnmatchedCallAtNewBatch', () => {
    const value = translated({
      messages: [
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_reused',
              type: 'custom',
              custom: { name: 'apply_patch', input: 'old patch' },
            },
          ],
        },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'call_reused', type: 'function', function: { name: 'lookup', arguments: '{}' } },
          ],
        },
        { role: 'tool', tool_call_id: 'call_reused', content: 'found' },
      ],
    });

    expect(value.input.map((item) => item.type)).toEqual([
      'custom_tool_call',
      'function_call',
      'function_call_output',
    ]);
  });
});

describe('Codex ambiguous tool batches crossing Chat requests', () => {
  it('TestAmbiguousDuplicateToolCallIDsAreDropped', () => {
    const value = translated({
      messages: [
        { role: 'user', content: 'Run both tools.' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_duplicate',
              type: 'function',
              function: { name: 'lookup', arguments: '{}' },
            },
            {
              id: 'call_duplicate',
              type: 'custom',
              custom: { name: 'apply_patch', input: 'patch' },
            },
          ],
        },
        { role: 'tool', tool_call_id: 'call_duplicate', content: 'first' },
        { role: 'tool', tool_call_id: 'call_duplicate', content: 'second' },
      ],
    });

    expect(value.input).toEqual([
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Run both tools.' }] },
    ]);
  });
});

describe('Codex orphan tool outputs crossing Chat requests', () => {
  it('TestOrphanAndDuplicateToolCallOutputsAreDropped', () => {
    const value = translated({
      messages: [
        { role: 'tool', tool_call_id: 'call_orphan', content: 'orphan' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_custom',
              type: 'function',
              function: { name: 'apply_patch', arguments: 'patch' },
            },
          ],
        },
        { role: 'tool', tool_call_id: 'call_custom', content: 'patched' },
        { role: 'tool', tool_call_id: 'call_custom', content: 'duplicate' },
      ],
      tools: [{ type: 'custom', name: 'apply_patch' }],
    });

    expect(value.input.map((item) => item.type)).toEqual([
      'custom_tool_call',
      'custom_tool_call_output',
    ]);
    expect(value.input[1]).toHaveProperty('output', 'patched');
  });
});

function translated(request: ChatCompletionsRequest): ResponsesRequest {
  const result = translateRequest('chat-completions', 'responses', request);

  if ('outcome' in result || 'refusal' in result) throw new Error('expected request');

  return result.value;
}
