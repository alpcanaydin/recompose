import { describe, expect, it } from 'vitest';

import { translateResponse } from './dispatcher';
import { responsesToolRefs } from './responses-extended-tools';
import { restoreResponsesToolResponse } from './responses-tool-restoration';

describe('Claude custom tool responses crossing Responses', () => {
  it('should restore a custom call and its string input', () => {
    const refs = responsesToolRefs({
      input: [{ type: 'additional_tools', tools: [{ type: 'custom', name: 'exec' }] }],
    });
    const translated = translateResponse('anthropic', 'responses', {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'call_1', name: 'exec', input: { input: 'pwd' } }],
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    if ('outcome' in translated || 'refusal' in translated) {
      throw new Error('expected translated response');
    }

    expect(restoreResponsesToolResponse(translated.value, refs).output[0]).toEqual({
      type: 'custom_tool_call',
      id: 'ctc_call_1',
      call_id: 'call_1',
      name: 'exec',
      input: 'pwd',
    });
  });

  it('should keep direct custom precedence over a namespace collision', () => {
    const refs = responsesToolRefs({
      input: [],
      tools: [
        {
          type: 'namespace',
          name: 'n',
          tools: [{ type: 'function', name: 'x', parameters: { type: 'object' } }],
        },
        { type: 'custom', name: 'n__x' },
      ],
    });
    const response = restoreResponsesToolResponse(baseResponse('n__x'), refs);

    expect(response.output[0]).toMatchObject({ type: 'custom_tool_call', name: 'n__x' });
  });
});

describe('Claude namespace responses crossing Responses', () => {
  it('should split the qualified name back into namespace and child', () => {
    const refs = responsesToolRefs({
      input: [],
      tools: [
        {
          type: 'namespace',
          name: 'mcp__node_repl',
          tools: [{ type: 'function', name: 'js', parameters: { type: 'object' } }],
        },
      ],
    });
    const response = restoreResponsesToolResponse(baseResponse('mcp__node_repl__js'), refs);

    expect(response.output[0]).toMatchObject({
      type: 'function_call',
      name: 'js',
      namespace: 'mcp__node_repl',
    });
  });
});

function baseResponse(name: string) {
  return {
    id: 'resp_1',
    status: 'completed' as const,
    output: [{ type: 'function_call' as const, call_id: 'call_1', name, arguments: '{}' }],
    usage: {},
  };
}
