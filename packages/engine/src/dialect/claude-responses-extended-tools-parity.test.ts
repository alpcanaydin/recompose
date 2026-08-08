import { describe, expect, it } from 'vitest';

import type { RequestOf } from './dispatcher';

import { translateRequest } from './dispatcher';
import { qualifyResponsesToolName } from './responses-extended-tools';

describe('Responses extended tools crossing Claude', () => {
  it('should merge additional tools, flatten namespaces, and prefer top-level tools', () => {
    const value = translatedValue(mergedToolsRequest());
    const tools = value.tools ?? [];

    expect(tools.map((tool) => tool.name)).toEqual([
      'exec',
      'collaboration__spawn',
      'wait',
      'collaboration__send',
    ]);
    expect(tools.find((tool) => tool.name === 'exec')?.description).toBe('top-level exec');
    expect(tools.find((tool) => tool.name === 'collaboration__send')?.input_schema).toMatchObject({
      properties: { input: { type: 'string' } },
    });
  });
});

describe('Responses unsupported custom tools crossing Claude', () => {
  it('should drop apply_patch while retaining supported function tools', () => {
    const value = translatedValue({
      input: [{ type: 'message', role: 'user', content: 'hi' }],
      tools: [
        { type: 'custom', name: 'apply_patch' },
        { type: 'function', name: 'exec_command', parameters: { type: 'object' } },
      ],
    });

    expect(value.tools?.map((tool) => tool.name)).toEqual(['exec_command']);
  });
});

describe('Responses extended tool collision precedence', () => {
  it('should let a direct custom tool beat an earlier namespace expansion', () => {
    const value = translatedValue({
      input: [{ type: 'message', role: 'user', content: 'hi' }],
      tools: [
        {
          type: 'namespace',
          name: 'n',
          tools: [{ type: 'function', name: 'x', parameters: { type: 'object' } }],
        },
        { type: 'custom', name: 'n__x' },
      ],
      tool_choice: { type: 'custom', name: 'n__x' },
    });
    const tool = value.tools?.[0];

    expect(tool?.name).toBe('n__x');
    expect(tool?.input_schema).toMatchObject({ properties: { input: { type: 'string' } } });
    expect(value.tool_choice).toEqual({ type: 'tool', name: 'n__x' });
  });

  it('should avoid prefix collisions while qualifying namespace children', () => {
    expect(qualifyResponsesToolName('collab', 'collaboration')).toBe('collab__collaboration');
    expect(qualifyResponsesToolName('collab', 'collab__send')).toBe('collab__send');
    expect(qualifyResponsesToolName('collab__', 'send')).toBe('collab__send');
  });
});

describe('Responses custom tool history crossing Claude', () => {
  it('should replay custom calls and outputs as standard Claude tool history', () => {
    const value = translatedValue({
      tools: [{ type: 'custom', name: 'exec' }],
      input: [
        { type: 'custom_tool_call', call_id: 'call.custom:1', name: 'exec', input: 'pwd' },
        { type: 'custom_tool_call_output', call_id: 'call.custom:1', output: '/workspace' },
      ],
    });

    expect(value.messages[0]?.content[0]).toEqual({
      type: 'tool_use',
      id: 'call_custom_1',
      name: 'exec',
      input: { input: 'pwd' },
    });
    expect(value.messages[1]?.content[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'call_custom_1',
      content: [{ type: 'text', text: '/workspace' }],
    });
  });
});

describe('Responses namespaced history crossing Claude', () => {
  it('should qualify calls, declarations, and tool choice consistently', () => {
    const value = translatedValue(namespacedHistoryRequest());

    expect(value.tools?.[0]?.name).toBe('mcp__node_repl__js');
    expect(value.messages[0]?.content[0]).toHaveProperty('name', 'mcp__node_repl__js');
    expect(value.messages[1]?.content[0]).toHaveProperty('tool_use_id', 'call_namespace');
    expect(value.tool_choice).toEqual({ type: 'tool', name: 'mcp__node_repl__js' });
  });
});

function translatedValue(body: RequestOf['responses']) {
  const translated = translateRequest('responses', 'anthropic', body);

  if ('outcome' in translated || 'refusal' in translated) {
    throw new Error('expected translated request');
  }

  return translated.value;
}

function mergedToolsRequest(): RequestOf['responses'] {
  return {
    tools: [
      {
        type: 'function',
        name: 'exec',
        description: 'top-level exec',
        parameters: { type: 'object', properties: { command: { type: 'string' } } },
      },
      {
        type: 'namespace',
        name: 'collaboration',
        tools: [{ type: 'function', name: 'spawn', parameters: { type: 'object' } }],
      },
    ],
    input: [
      {
        type: 'additional_tools',
        tools: [
          { type: 'custom', name: 'exec', description: 'additional exec' },
          { type: 'function', name: 'wait', parameters: { type: 'object' } },
          {
            type: 'namespace',
            name: 'collaboration',
            tools: [
              { type: 'function', name: 'spawn', parameters: { type: 'object' } },
              { type: 'custom', name: 'send', description: 'send a message' },
            ],
          },
        ],
      },
      { type: 'message', role: 'user', content: 'hello' },
    ],
  };
}

function namespacedHistoryRequest(): RequestOf['responses'] {
  return {
    input: [
      {
        type: 'additional_tools',
        tools: [
          {
            type: 'namespace',
            name: 'mcp__node_repl',
            tools: [{ type: 'function', name: 'js', parameters: { type: 'object' } }],
          },
        ],
      },
      {
        type: 'function_call',
        call_id: 'call.namespace',
        name: 'js',
        namespace: 'mcp__node_repl',
        arguments: '{"code":"pwd"}',
      },
      { type: 'function_call_output', call_id: 'call.namespace', output: 'ok' },
    ],
    tool_choice: { type: 'function', name: 'js', namespace: 'mcp__node_repl' },
  };
}
