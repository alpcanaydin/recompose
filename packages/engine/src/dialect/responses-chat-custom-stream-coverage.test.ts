import { describe, expect, it } from 'vitest';

import type { ResponsesOutputItem, ResponsesStreamEvent } from './responses-wire';

import { responsesStreamForChat } from './responses-chat-custom-stream';

describe('a custom tool call opening in a chat stream', () => {
  it('should name the call after its item when it carries no call identifier', async () => {
    const events = await streamed([
      { type: 'response.output_item.added', output_index: 0, item: customCall({ id: 'item_1' }) },
    ]);

    expect(events).toEqual([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: {
          type: 'function_call',
          id: 'item_1',
          call_id: 'item_1',
          name: '',
          arguments: '',
        },
      },
    ]);
  });

  it('should invent a call name from its place when the item identifies nothing', async () => {
    const events = await streamed([
      { type: 'response.output_item.added', output_index: 3, item: customCall({}) },
    ]);

    expect(events).toHaveProperty('0.item.call_id', 'call_3');
  });

  it('should leave an ordinary output item alone', async () => {
    const added: ResponsesStreamEvent = {
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'message', role: 'assistant' },
    };

    await expect(streamed([added])).resolves.toEqual([added]);
  });

  it('should pass an event this engine does not know straight through', async () => {
    const unknown: ResponsesStreamEvent = { type: 'response.custom_thing' };

    await expect(streamed([unknown])).resolves.toEqual([unknown]);
  });
});

describe('custom tool call input arriving in a chat stream', () => {
  it('should carry each input fragment as function call arguments', async () => {
    const events = await streamed([
      openedCall(),
      { type: 'response.custom_tool_call_input.delta', output_index: 0, delta: 'ls ' },
      { type: 'response.custom_tool_call_input.delta', output_index: 0, delta: '-la' },
    ]);

    expect(events.slice(1)).toEqual([argumentsDelta('ls '), argumentsDelta('-la')]);
  });

  it('should say nothing for an empty fragment or a call it never saw open', async () => {
    const events = await streamed([
      openedCall(),
      { type: 'response.custom_tool_call_input.delta', output_index: 0, delta: '' },
      { type: 'response.custom_tool_call_input.delta', output_index: 9, delta: 'orphan' },
    ]);

    expect(events).toHaveLength(1);
  });

  it('should send the whole input once when no fragment carried it', async () => {
    const events = await streamed([
      openedCall(),
      { type: 'response.custom_tool_call_input.done', output_index: 0, input: 'ls -la' },
    ]);

    expect(events.slice(1)).toEqual([argumentsDelta('ls -la')]);
  });

  it('should not repeat an input the fragments already carried', async () => {
    const events = await streamed([
      openedCall(),
      { type: 'response.custom_tool_call_input.delta', output_index: 0, delta: 'ls' },
      { type: 'response.custom_tool_call_input.done', output_index: 0, input: 'ls' },
      { type: 'response.custom_tool_call_input.done', output_index: 0, input: '' },
    ]);

    expect(events).toHaveLength(2);
  });
});

describe('a custom tool call closing in a chat stream', () => {
  it('should close a call this stream never announced', async () => {
    const events = await streamed([
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: customCall({ call_id: 'call_1', name: 'run_command' }),
      },
    ]);

    expect(events).toEqual([
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          type: 'function_call',
          id: 'call_1',
          call_id: 'call_1',
          name: 'run_command',
          arguments: '',
        },
      },
    ]);
  });

  it('should leave an ordinary closing item alone', async () => {
    const done: ResponsesStreamEvent = { type: 'response.output_item.done', output_index: 0 };

    await expect(streamed([done])).resolves.toEqual([done]);
  });
});

describe('a chat stream ending after custom tool calls', () => {
  it('should list the calls it saw when the answer names no output', async () => {
    const events = await streamed([openedCall(), completedWith([])]);

    expect(events.at(-1)).toHaveProperty('response.output', [
      { type: 'function_call', call_id: 'call_1', name: 'run_command', arguments: '' },
    ]);
  });

  it('should leave an answer that already names its output alone', async () => {
    const output: ResponsesOutputItem[] = [{ type: 'reasoning', id: 'reason_1' }];

    const events = await streamed([openedCall(), completedWith(output)]);

    expect(events.at(-1)).toHaveProperty('response.output', output);
  });
});

function customCall(fields: { id?: string; call_id?: string; name?: string }) {
  return { type: 'custom_tool_call', ...fields };
}

function openedCall(): ResponsesStreamEvent {
  return {
    type: 'response.output_item.added',
    output_index: 0,
    item: customCall({ call_id: 'call_1', name: 'run_command' }),
  };
}

function argumentsDelta(delta: string) {
  return {
    type: 'response.function_call_arguments.delta',
    output_index: 0,
    item_id: undefined,
    call_id: 'call_1',
    name: 'run_command',
    delta,
  };
}

function completedWith(output: readonly ResponsesOutputItem[]): ResponsesStreamEvent {
  return {
    type: 'response.completed',
    response: { id: 'resp_1', status: 'completed', output },
  };
}

async function streamed(events: readonly ResponsesStreamEvent[]): Promise<ResponsesStreamEvent[]> {
  const collected: ResponsesStreamEvent[] = [];

  for await (const event of responsesStreamForChat(replay(events))) collected.push(event);

  return collected;
}

async function* replay(
  events: readonly ResponsesStreamEvent[],
): AsyncIterable<ResponsesStreamEvent> {
  for (const event of events) yield await Promise.resolve(event);
}
