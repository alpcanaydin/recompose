import { describe, expect, test } from 'vitest';

import type { ResponsesFunctionTool, ResponsesRequest } from './responses-wire';

import { normalizeResponsesExtensions } from './responses-extended-tools';

function requestWith(overrides: Partial<ResponsesRequest>): ResponsesRequest {
  return { model: 'gpt-5', input: [], ...overrides };
}

function functionTool(name: string): ResponsesFunctionTool {
  return { type: 'function', name, parameters: { type: 'object' } };
}

describe('flattening a namespace of tools', () => {
  test('an unnamed namespace keeps only the children it can express as functions', () => {
    const request = requestWith({
      tools: [
        {
          type: 'namespace',
          name: '',
          tools: [
            { type: 'web_search' },
            { type: 'custom', name: 'apply_patch' },
            { type: 'custom', name: 'run' },
          ],
        },
      ],
    });

    const normalized = normalizeResponsesExtensions(request);

    expect(normalized.tools).toStrictEqual([
      {
        type: 'function',
        name: 'run',
        parameters: {
          type: 'object',
          properties: { input: { type: 'string' } },
          required: ['input'],
        },
      },
    ]);
  });
});

describe('keying a web search tool that has no name', () => {
  test('web search survives alongside a named function', () => {
    const request = requestWith({ tools: [{ type: 'web_search' }, functionTool('Read')] });

    const normalized = normalizeResponsesExtensions(request);

    expect(normalized.tools).toStrictEqual([{ type: 'web_search' }, functionTool('Read')]);
  });
});

describe('rewriting the calls a client already made', () => {
  test('a custom call with no input and its empty output both become function shapes', () => {
    const request = requestWith({
      input: [
        { type: 'custom_tool_call', call_id: 'call_1', name: 'run' },
        { type: 'custom_tool_call_output', call_id: 'call_1' },
      ],
    });

    const normalized = normalizeResponsesExtensions(request);

    expect(normalized.input).toStrictEqual([
      { type: 'function_call', call_id: 'call_1', name: 'run', arguments: '{}' },
      { type: 'function_call_output', call_id: 'call_1', output: '' },
    ]);
  });

  test('a custom call whose input is structured is serialized whole', () => {
    const request = requestWith({
      input: [{ type: 'custom_tool_call', call_id: 'call_2', name: 'run', input: { cmd: 'ls' } }],
    });

    const normalized = normalizeResponsesExtensions(request);

    expect(normalized.input).toStrictEqual([
      { type: 'function_call', call_id: 'call_2', name: 'run', arguments: '{"cmd":"ls"}' },
    ]);
  });

  test('a call naming one namespaced child alone recovers its qualified name', () => {
    const request = requestWith({
      tools: [{ type: 'namespace', name: 'shell', tools: [functionTool('run')] }],
      input: [{ type: 'function_call', call_id: 'call_3', name: 'run', arguments: '{}' }],
    });

    const normalized = normalizeResponsesExtensions(request);

    expect(normalized.input).toStrictEqual([
      { type: 'function_call', call_id: 'call_3', name: 'shell__run', arguments: '{}' },
    ]);
  });
});

describe('rewriting the tool the client insists on', () => {
  test('a web search choice is left exactly as it arrived', () => {
    const request = requestWith({
      tools: [{ type: 'web_search' }],
      tool_choice: { type: 'web_search' },
    });

    expect(normalizeResponsesExtensions(request).tool_choice).toStrictEqual({
      type: 'web_search',
    });
  });

  test('a choice naming a namespaced child alone is qualified to match the tool', () => {
    const request = requestWith({
      tools: [{ type: 'namespace', name: 'shell', tools: [functionTool('run')] }],
      tool_choice: { type: 'function', name: 'run' },
    });

    expect(normalizeResponsesExtensions(request).tool_choice).toStrictEqual({
      type: 'function',
      name: 'shell__run',
    });
  });
});
