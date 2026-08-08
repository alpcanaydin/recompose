import { describe, expect, it } from 'vitest';

import type { ResponsesStreamEvent } from './responses-wire';

import { responsesToolRefs } from './responses-extended-tools';
import { restoreResponsesToolStream } from './responses-tool-stream-restoration';

describe('Claude custom tool streams crossing Responses', () => {
  it('should replace function events with a custom tool lifecycle', async () => {
    const refs = responsesToolRefs({
      input: [{ type: 'additional_tools', tools: [{ type: 'custom', name: 'exec' }] }],
    });
    const events = await restored(toolStream('exec', '{"input":"pwd"}'), refs);

    expect(events.some((event) => event.type === 'response.function_call_arguments.delta')).toBe(
      false,
    );
    expect(events).toContainEqual({
      type: 'response.custom_tool_call_input.done',
      output_index: 0,
      item_id: 'ctc_call_1',
      input: 'pwd',
    });
    const done = events.find((event) => event.type === 'response.output_item.done');

    expect(done).toHaveProperty('item.type', 'custom_tool_call');
    expect(done).toHaveProperty('item.name', 'exec');
    expect(done).toHaveProperty('item.input', 'pwd');
    expect(events.at(-1)).toHaveProperty('response.output.0', {
      type: 'custom_tool_call',
      id: 'ctc_call_1',
      call_id: 'call_1',
      name: 'exec',
      input: 'pwd',
    });
  });

  it('should normalize empty custom input consistently', async () => {
    const refs = responsesToolRefs({ input: [], tools: [{ type: 'custom', name: 'exec' }] });
    const events = await restored(toolStream('exec', '{}'), refs);

    expect(events.at(-1)).toHaveProperty('response.output.0.input', '');
  });
});

describe('Claude namespace tool streams crossing Responses', () => {
  it('should restore child name and namespace on every output item', async () => {
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
    const events = await restored(toolStream('mcp__node_repl__js', '{"code":"pwd"}'), refs);

    expect(events[0]).toHaveProperty('item', {
      type: 'function_call',
      id: 'call_1',
      call_id: 'call_1',
      name: 'js',
      namespace: 'mcp__node_repl',
    });
    expect(events.at(-1)).toHaveProperty('response.output.0.namespace', 'mcp__node_repl');
  });
});

function toolStream(name: string, argumentsJson: string): readonly ResponsesStreamEvent[] {
  const item = { type: 'function_call', id: 'call_1', call_id: 'call_1', name };
  const complete = {
    type: 'function_call' as const,
    call_id: 'call_1',
    name,
    arguments: argumentsJson,
  };

  return [
    { type: 'response.output_item.added', output_index: 0, item },
    { type: 'response.function_call_arguments.delta', output_index: 0, delta: argumentsJson },
    {
      type: 'response.function_call_arguments.done',
      output_index: 0,
      item_id: 'call_1',
      arguments: argumentsJson,
    },
    {
      type: 'response.output_item.done',
      output_index: 0,
      item: { ...item, arguments: argumentsJson },
    },
    {
      type: 'response.completed',
      response: { id: 'resp_1', status: 'completed', output: [complete] },
    },
  ];
}

async function restored(
  source: readonly ResponsesStreamEvent[],
  refs: Parameters<typeof restoreResponsesToolStream>[1],
) {
  const events = [];

  for await (const event of restoreResponsesToolStream(streamOf(source), refs)) events.push(event);

  return events;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
