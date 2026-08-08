import { describe, expect, it } from 'vitest';

import {
  addedItems,
  addedTools,
  callId,
  chatResponse,
  chunk,
  collaborationRef,
  completed,
  doneToolEvents,
  doneTools,
  execRef,
  isCompleted,
  lateToolChoice,
  namespaceRef,
  nonStream,
  streamed,
  terminalRef,
  tool,
  toolChoice,
  toolStream,
  toolSummary,
  usage,
} from './openai-responses-chat-response-parity.testkit';

describe('OpenAI Chat response stream lifecycle parity', () => {
  it('ResponseCompletedWaitsForDone', async () => {
    const events = await streamed([
      chunk('resp_late_usage', [{ index: 0, delta: { content: 'hello' } }]),
      chunk('resp_late_usage', [], usage(11, 7)),
      { type: 'done' },
    ]);

    expect(events.filter(isCompleted)).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      type: 'response.completed',
      response: {
        model: 'gpt-5.4',
        usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 },
      },
    });
  });
  it('MultipleToolCallsRemainSeparate', async () => {
    const events = await toolStream('resp_test', [
      tool(0, 'call_read', 'read', '{"filePath":"C:\\\\repo"}'),
      tool(1, 'call_glob', 'glob', '{"path":"C:\\\\repo","pattern":"*.{yml,yaml}"}'),
    ]);

    expect(doneTools(events).map(toolSummary)).toEqual([
      { call_id: 'call_read', name: 'read', arguments: '{"filePath":"C:\\\\repo"}' },
      {
        call_id: 'call_glob',
        name: 'glob',
        arguments: '{"path":"C:\\\\repo","pattern":"*.{yml,yaml}"}',
      },
    ]);
    expect(completed(events).output).toHaveLength(2);
  });
  it('MultiChoiceToolCallsUseDistinctOutputIndexes', async () => {
    const events = await streamed([
      chunk('resp_multi_choice', [
        toolChoice(0, tool(0, 'call_choice0', 'glob', '{"path":"repo"}')),
        toolChoice(1, tool(0, 'call_choice1', 'read', '{"filePath":"README.md"}')),
      ]),
      { type: 'done' },
    ]);
    const indexes = addedTools(events).map((event) => event.output_index);

    expect(indexes).toHaveLength(2);
    expect(new Set(indexes).size).toBe(2);
  });
});
describe('OpenAI Chat mixed output parity', () => {
  it('MixedMessageAndToolUseDistinctOutputIndexes', async () => {
    const events = await streamed([
      chunk('resp_mixed', [
        { index: 0, delta: { content: 'hello' }, finish_reason: 'stop' },
        toolChoice(1, tool(0, 'call_choice1', 'read', '{"filePath":"README.md"}')),
      ]),
      { type: 'done' },
    ]);

    expect(addedItems(events).map((event) => event.output_index)).toEqual([0, 1]);
  });
  it('CompletedOmitsTopLevelOutputText', async () => {
    const events = await streamed([
      chunk('resp_output_text', [
        { index: 0, delta: { content: 'hello world' }, finish_reason: 'stop' },
      ]),
      { type: 'done' },
    ]);

    expect('output_text' in completed(events)).toBe(false);
    expect(completed(events).output[0]).toMatchObject({ content: [{ text: 'hello world' }] });
  });
  it('ToolCallCompletedOmitsTopLevelOutputText', async () => {
    const events = await streamed([
      chunk('resp_tool_output_text', [{ index: 0, delta: { content: 'tool next' } }]),
      chunk('resp_tool_output_text', [
        toolChoice(0, tool(0, 'call_weather', 'get_weather', '{"location":"北京"}')),
      ]),
      { type: 'done' },
    ]);

    expect('output_text' in completed(events)).toBe(false);
    expect(completed(events).output).toMatchObject([
      { type: 'message' },
      { type: 'function_call', arguments: '{"location":"北京"}' },
    ]);
  });
});
describe('OpenAI Chat output ordering parity', () => {
  it('FunctionCallDoneAndCompletedOutputStayAscending', async () => {
    const events = await toolStream('resp_order', [
      tool(0, 'call_glob', 'glob', '{"path":"repo"}'),
      tool(1, 'call_read', 'read', '{"filePath":"README.md"}'),
    ]);

    expect(doneToolEvents(events).map((event) => event.output_index)).toEqual([0, 1]);
    expect(completed(events).output.map(callId)).toEqual(['call_glob', 'call_read']);
  });
  it('NonStream_OmitsTopLevelOutputText', () => {
    const response = nonStream(chatResponse({ content: 'ping' }));

    expect('output_text' in response).toBe(false);
    expect(response.output[0]).toMatchObject({ content: [{ text: 'ping' }] });
  });
});
describe('OpenAI Chat namespace response parity', () => {
  it('RestoresNamespaceFunctionCall', async () => {
    const events = await toolStream(
      'namespace_stream',
      [tool(0, 'call_ns', 'mcp__test_mcp__add_numbers', '{"a":3,"b":5}')],
      namespaceRef,
    );

    expect(addedTools(events)[0]?.item).toMatchObject({
      name: 'add_numbers',
      namespace: 'mcp__test_mcp__',
    });
    expect(completed(events).output[0]).toMatchObject({
      name: 'add_numbers',
      namespace: 'mcp__test_mcp__',
    });
  });
  it('NonStream_RestoresNamespaceFunctionCall', () => {
    const response = nonStream(
      chatResponse({ toolName: 'mcp__test_mcp__add_numbers' }),
      namespaceRef,
    );

    expect(response.output[0]).toMatchObject({ name: 'add_numbers', namespace: 'mcp__test_mcp__' });
  });
});
describe('OpenAI Chat custom tool response parity', () => {
  it('CustomToolNameArrivesLate', async () => {
    const events = await streamed(
      [
        chunk('custom_late', [lateToolChoice({ id: 'call_exec', arguments: '' })]),
        chunk('custom_late', [
          lateToolChoice({ name: 'exec', arguments: '{"input":"pwd"}', finish: true }),
        ]),
        { type: 'done' },
      ],
      execRef,
    );

    expect(addedItems(events)[0]?.item).toMatchObject({
      type: 'custom_tool_call',
      id: 'ctc_call_exec',
      name: 'exec',
    });
    expect(completed(events).output[0]).toMatchObject({ type: 'custom_tool_call', input: 'pwd' });
  });
});

describe('OpenAI Chat missing custom tool metadata parity', () => {
  it('CustomToolNameAndIDAreMissing', async () => {
    const events = await streamed(
      [
        chunk('chatcmpl_custom_missing_fields', [
          lateToolChoice({ arguments: '{"input":"pwd"}', finish: true }),
        ]),
        { type: 'done' },
      ],
      execRef,
    );

    expect(completed(events).output[0]).toMatchObject({
      type: 'custom_tool_call',
      id: 'ctc_call_chatcmpl_custom_missing_fields_0_0',
      call_id: 'call_chatcmpl_custom_missing_fields_0_0',
      name: 'exec',
    });
  });
  it('ToolCallIDMayArriveLateOrBeMissing', async () => {
    const late = await streamed([
      chunk('chatcmpl_late_id', [lateToolChoice({ name: 'read', arguments: '{"file' })]),
      chunk('chatcmpl_late_id', [
        lateToolChoice({ id: 'call_late', arguments: 'Path":"README.md"}', finish: true }),
      ]),
      { type: 'done' },
    ]);
    const missing = await toolStream('chatcmpl_missing_id', [
      tool(0, undefined, 'read', '{"filePath":"README.md"}'),
    ]);

    expect(addedItems(late)[0]?.item).toMatchObject({ id: 'fc_call_late', call_id: 'call_late' });
    expect(addedItems(missing)[0]?.item).toMatchObject({
      id: 'fc_call_chatcmpl_missing_id_0_0',
      call_id: 'call_chatcmpl_missing_id_0_0',
    });
  });
});
describe('OpenAI Chat additional tool response parity', () => {
  it('RestoresAdditionalNamespaceFunctionCall', async () => {
    const events = await toolStream(
      'additional_namespace',
      [tool(0, 'call_send', 'collaboration__send_message', '{"message":"ping"}')],
      collaborationRef,
    );

    expect(completed(events).output[0]).toMatchObject({
      name: 'send_message',
      namespace: 'collaboration',
    });
  });
  it('NonStream_RestoresAdditionalNamespaceFunctionCall', () => {
    const response = nonStream(
      chatResponse({ toolName: 'collaboration__send_message' }),
      collaborationRef,
    );

    expect(response.output[0]).toMatchObject({ name: 'send_message', namespace: 'collaboration' });
  });
  it('RestoresAdditionalNamespaceCustomToolCall', async () => {
    const events = await toolStream(
      'additional_custom',
      [tool(0, 'call_exec', 'terminal__exec', '{"input":"pwd"}')],
      terminalRef,
    );

    expect(completed(events).output[0]).toMatchObject({
      type: 'custom_tool_call',
      name: 'terminal__exec',
      input: 'pwd',
    });
  });
  it('NonStream_RestoresAdditionalNamespaceCustomToolCall', () => {
    const response = nonStream(
      chatResponse({ toolName: 'terminal__exec', arguments: '{"input":"pwd"}' }),
      terminalRef,
    );

    expect(response.output[0]).toMatchObject({
      type: 'custom_tool_call',
      name: 'terminal__exec',
      input: 'pwd',
    });
  });
});
