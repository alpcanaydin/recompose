import { describe, expect, it } from 'vitest';

import type {
  ChatCompletionsRequest,
  ChatResponseMessage,
  ChatToolCall,
} from './chat-completions-wire';
import type { ResponsesRequest, ResponsesResponse } from './responses-wire';

import { translateRequest, translateResponse } from './dispatcher';

describe('Codex custom tool names crossing Chat requests', () => {
  it('TestCustomToolNameShortening', () => {
    const longName = 'a_very_long_custom_tool_name_that_exceeds_sixty_four_characters_limit_test';
    const value = translated(
      requestWithTools(
        [customTool(longName)],
        [call('call_custom_long', longName, 'patch'), output('call_custom_long', 'patched')],
        { type: 'custom', name: longName },
      ),
    );
    const item = value.input.find((entry) => entry.type === 'custom_tool_call');

    if (item === undefined) throw new Error('expected custom call');

    expect(item.name).not.toBe(longName);
    expect(item.name.length).toBeLessThanOrEqual(64);
    expect(value.tools?.[0]).toMatchObject({ type: 'custom', name: item.name });
    expect(value.tool_choice).toEqual({ type: 'custom', name: item.name });
    expect(value.input).toContainEqual({
      type: 'custom_tool_call_output',
      call_id: 'call_custom_long',
      output: 'patched',
    });
  });
});

describe('Codex custom tool family collisions crossing Chat requests', () => {
  it('TestCustomToolShortNameCollisionPreservesFunctionFamily', () => {
    const customName = 'a_very_long_custom_tool_name_that_exceeds_sixty_four_characters_limit_test';
    const functionName = customName.slice(0, 64);
    const value = translated(
      requestWithTools(
        [customTool(customName), functionTool(functionName)],
        [call('call_function', functionName, '{}'), output('call_function', 'done')],
        { type: 'function', function: { name: functionName } },
      ),
    );

    expect(value.input.map((item) => item.type)).toEqual(['function_call', 'function_call_output']);
    expect(value.tool_choice).toMatchObject({ type: 'function' });
  });
});

describe('Codex custom tool response follow-up crossing Chat requests', () => {
  it('TestSameNameCustomAndFunctionDefaultsToFunctionFamily', () => {
    const value = translated(
      requestWithTools(
        [customTool('shared_tool'), functionTool('shared_tool')],
        [call('call_shared', 'shared_tool', '{}'), output('call_shared', 'done')],
        { type: 'function', function: { name: 'shared_tool' } },
      ),
    );

    expect(value.input.map((item) => item.type)).toEqual(['function_call', 'function_call_output']);
    expect(value.tools?.map((tool) => tool.type)).toEqual(['custom', 'function']);
    expect(value.tool_choice).toEqual({ type: 'function', name: 'shared_tool' });
  });
});

describe('Codex custom tool history crossing Chat requests', () => {
  it('TestCustomToolCallHistory', () => {
    const patch = '*** Begin Patch\n*** Add File: spec.md\n+done\n*** End Patch';
    const request = requestWithTools(
      [customTool('apply_patch')],
      [
        { role: 'user', content: 'Update the specification.' },
        {
          role: 'assistant',
          content: 'I will update the file.',
          tool_calls: [functionCall('call_apply_patch', 'apply_patch', patch)],
        },
        output('call_apply_patch', 'Added spec.md'),
        { role: 'assistant', content: 'The specification is updated.' },
      ],
      { type: 'function', function: { name: 'apply_patch' } },
    );
    const value = translated(request);

    expect(value.input.map((item) => item.type)).toEqual([
      'message',
      'message',
      'custom_tool_call',
      'custom_tool_call_output',
      'message',
    ]);
    expect(value.input[2]).toMatchObject({
      call_id: 'call_apply_patch',
      name: 'apply_patch',
      input: patch,
    });
    expect(value.tool_choice).toEqual({ type: 'custom', name: 'apply_patch' });
  });
});

describe('Codex mixed tool families crossing Chat requests', () => {
  it('TestCustomToolCallResponseFollowUpRoundTrip', () => {
    const assistant = chatMessage(customResponse());
    const value = translated(
      requestWithTools(
        [customTool('apply_patch')],
        [{ role: 'user', content: 'Apply the patch.' }, assistant, output('call_patch', 'patched')],
      ),
    );

    expect(assistant.tool_calls?.[0]).toMatchObject({
      type: 'function',
      function: { arguments: 'patch' },
    });
    expect(value.input.map((item) => item.type)).toEqual([
      'message',
      'custom_tool_call',
      'custom_tool_call_output',
    ]);
  });

  it('TestMixedToolCallHistoryPreservesCallFamilies', () => {
    const value = translated(
      requestWithTools(
        [functionTool('lookup'), customTool('apply_patch')],
        [
          { role: 'user', content: 'Run both tools.' },
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              functionCall('call_function', 'lookup', '{}'),
              functionCall('call_custom', 'apply_patch', 'patch'),
            ],
          },
          output('call_custom', 'patched'),
          output('call_function', 'found'),
        ],
      ),
    );

    expect(value.input.map((item) => item.type)).toEqual([
      'message',
      'function_call',
      'custom_tool_call',
      'custom_tool_call_output',
      'function_call_output',
    ]);
  });
});

// Helpers

function translated(request: ChatCompletionsRequest): ResponsesRequest {
  const result = translateRequest('chat-completions', 'responses', request);

  if ('outcome' in result || 'refusal' in result) throw new Error('expected request');

  return result.value;
}

function requestWithTools(
  tools: NonNullable<ChatCompletionsRequest['tools']>,
  messages: ChatCompletionsRequest['messages'],
  toolChoice?: ChatCompletionsRequest['tool_choice'],
): ChatCompletionsRequest {
  return { messages, tools, ...(toolChoice === undefined ? {} : { tool_choice: toolChoice }) };
}

function customTool(
  name: string,
): Extract<NonNullable<ChatCompletionsRequest['tools']>[number], { type: 'custom' }> {
  return { type: 'custom', name, description: 'Custom tool.' };
}

function functionTool(
  name: string,
): Extract<NonNullable<ChatCompletionsRequest['tools']>[number], { type: 'function' }> {
  return { type: 'function', function: { name, parameters: { type: 'object', properties: {} } } };
}

function functionCall(id: string, name: string, args: string): ChatToolCall {
  return { id, type: 'function', function: { name, arguments: args } };
}

function call(id: string, name: string, args: string): ChatCompletionsRequest['messages'][number] {
  return { role: 'assistant', content: null, tool_calls: [functionCall(id, name, args)] };
}

function output(id: string, content: string): ChatCompletionsRequest['messages'][number] {
  return { role: 'tool', tool_call_id: id, content };
}

function customResponse(): ResponsesResponse {
  return {
    id: 'resp_1',
    status: 'completed',
    output: [
      { type: 'custom_tool_call', call_id: 'call_patch', name: 'apply_patch', input: 'patch' },
    ],
  };
}

function chatMessage(response: ResponsesResponse): ChatResponseMessage {
  const result = translateResponse('responses', 'chat-completions', response);

  if ('outcome' in result || 'refusal' in result) throw new Error('expected response');
  const message = result.value.choices[0]?.message;

  if (message === undefined) throw new Error('expected message');

  return message;
}
