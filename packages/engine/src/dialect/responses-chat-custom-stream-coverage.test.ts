import { describe, expect, it } from 'vitest';

import type { ResponsesStreamEvent, ResponsesStreamItem } from './responses-wire';

import { responsesStreamForChat } from './responses-chat-custom-stream';
import { collect, streamOf } from './responses.testkit';

function aCustomCall(overrides: Partial<ResponsesStreamItem> = {}): ResponsesStreamItem {
  return {
    type: 'custom_tool_call',
    id: 'ctc_1',
    call_id: 'call_1',
    name: 'run_script',
    ...overrides,
  };
}

function anAddedItem(index: number, item: ResponsesStreamItem): ResponsesStreamEvent {
  return { type: 'response.output_item.added', output_index: index, item };
}

function aDoneItem(index: number, item: ResponsesStreamItem): ResponsesStreamEvent {
  return { type: 'response.output_item.done', output_index: index, item };
}

function aFunctionCall(overrides: Partial<ResponsesStreamItem> = {}): ResponsesStreamItem {
  return {
    type: 'function_call',
    id: 'ctc_1',
    call_id: 'call_1',
    name: 'run_script',
    arguments: '',
    ...overrides,
  };
}

async function normalized(
  events: readonly ResponsesStreamEvent[],
): Promise<ResponsesStreamEvent[]> {
  const chatEvents = await collect(responsesStreamForChat(streamOf(events)));

  return chatEvents;
}

describe('responsesStreamForChat: a custom tool call reads as a function call', () => {
  it('carries the identity, the name, and the streamed input of the custom call', async () => {
    const events = await normalized([
      anAddedItem(0, aCustomCall()),
      { type: 'response.custom_tool_call_input.delta', output_index: 0, delta: 'echo hi' },
      aDoneItem(0, aCustomCall({ input: 'echo hi' })),
    ]);

    expect(events[0]).toEqual(anAddedItem(0, aFunctionCall()));
    expect(events[1]).toEqual({
      type: 'response.function_call_arguments.delta',
      output_index: 0,
      item_id: 'ctc_1',
      call_id: 'call_1',
      name: 'run_script',
      delta: 'echo hi',
    });
    expect(events[2]).toEqual(aDoneItem(0, aFunctionCall({ arguments: 'echo hi' })));
  });

  it('names an anonymous custom call by its position and leaves its name empty', async () => {
    const events = await normalized([anAddedItem(2, { type: 'custom_tool_call' })]);

    expect(events[0]).toEqual(
      anAddedItem(2, aFunctionCall({ id: 'call_2', call_id: 'call_2', name: '' })),
    );
  });

  it('completes a custom call that the stream never announced', async () => {
    const events = await normalized([aDoneItem(1, aCustomCall())]);

    expect(events[0]).toEqual(aDoneItem(1, aFunctionCall()));
  });
});

describe('responsesStreamForChat: an input that only the done event carries', () => {
  it('emits the whole input as one arguments delta', async () => {
    const events = await normalized([
      anAddedItem(0, aCustomCall()),
      { type: 'response.custom_tool_call_input.done', output_index: 0, input: 'echo hi' },
    ]);

    expect(events[1]).toMatchObject({
      type: 'response.function_call_arguments.delta',
      delta: 'echo hi',
    });
  });

  it('stays silent once a delta already carried the input', async () => {
    const events = await normalized([
      anAddedItem(0, aCustomCall()),
      { type: 'response.custom_tool_call_input.delta', output_index: 0, delta: 'echo' },
      { type: 'response.custom_tool_call_input.done', output_index: 0, input: 'echo' },
    ]);

    expect(events).toHaveLength(2);
  });

  it('stays silent when the input is empty', async () => {
    const events = await normalized([
      anAddedItem(0, aCustomCall()),
      { type: 'response.custom_tool_call_input.done', output_index: 0, input: '' },
    ]);

    expect(events).toHaveLength(1);
  });

  it('stays silent when no call opened at that output index', async () => {
    const events = await normalized([
      { type: 'response.custom_tool_call_input.done', output_index: 7, input: 'echo' },
    ]);

    expect(events).toEqual([]);
  });
});

describe('responsesStreamForChat: an input delta with nothing to attach to', () => {
  it('stays silent when the delta carries no text', async () => {
    const events = await normalized([
      anAddedItem(0, aCustomCall()),
      { type: 'response.custom_tool_call_input.delta', output_index: 0, delta: '' },
    ]);

    expect(events).toHaveLength(1);
  });

  it('stays silent when no call opened at that output index', async () => {
    const events = await normalized([
      { type: 'response.custom_tool_call_input.delta', output_index: 7, delta: 'echo' },
    ]);

    expect(events).toEqual([]);
  });
});

describe('responsesStreamForChat: a delta that omits its output index', () => {
  it('attaches to the call that announced the same item id', async () => {
    const events = await normalized([
      anAddedItem(0, aCustomCall()),
      { type: 'response.custom_tool_call_input.delta', item_id: 'ctc_1', delta: 'echo hi' },
    ]);

    expect(events[1]).toMatchObject({ call_id: 'call_1', delta: 'echo hi' });
  });

  it('attaches to the call opened last when it names no call at all', async () => {
    const events = await normalized([
      anAddedItem(0, aCustomCall()),
      anAddedItem(1, aCustomCall({ id: 'ctc_2', call_id: 'call_2' })),
      { type: 'response.custom_tool_call_input.delta', delta: 'echo hi' },
    ]);

    expect(events[2]).toMatchObject({ call_id: 'call_2', delta: 'echo hi' });
  });

  it('stays silent when it names no call and no call has opened yet', async () => {
    const events = await normalized([
      { type: 'response.custom_tool_call_input.delta', delta: 'echo hi' },
    ]);

    expect(events).toEqual([]);
  });
});

describe('responsesStreamForChat: the terminal response lists the calls it forgot', () => {
  it('fills an empty terminal output with the calls in output-index order', async () => {
    const events = await normalized([
      anAddedItem(1, aCustomCall({ id: 'ctc_2', call_id: 'call_2', name: 'second' })),
      anAddedItem(0, aCustomCall()),
      { type: 'response.failed', response: { id: 'resp_1', status: 'failed', output: [] } },
    ]);

    expect(events[2]).toMatchObject({
      response: {
        output: [
          { type: 'function_call', call_id: 'call_1', name: 'run_script', arguments: '' },
          { type: 'function_call', call_id: 'call_2', name: 'second', arguments: '' },
        ],
      },
    });
  });

  it('leaves a terminal response that already lists its output alone', async () => {
    const terminal: ResponsesStreamEvent = {
      type: 'response.incomplete',
      response: {
        id: 'resp_1',
        status: 'incomplete',
        output: [{ type: 'custom_tool_call', call_id: 'call_1', name: 'run_script', input: '' }],
      },
    };
    const events = await normalized([anAddedItem(0, aCustomCall()), terminal]);

    expect(events[1]).toEqual(terminal);
  });

  it('leaves a terminal response alone when no custom call ever opened', async () => {
    const terminal: ResponsesStreamEvent = {
      type: 'response.completed',
      response: { id: 'resp_1', status: 'completed', output: [] },
    };

    expect(await normalized([terminal])).toEqual([terminal]);
  });
});

describe('responsesStreamForChat: everything outside the custom lifecycle passes through', () => {
  it('leaves an output item that is not a custom tool call untouched', async () => {
    const added = anAddedItem(0, { type: 'message', role: 'assistant' });

    expect(await normalized([added])).toEqual([added]);
  });

  it('leaves a done event that carries no item untouched', async () => {
    const done: ResponsesStreamEvent = { type: 'response.output_item.done', output_index: 0 };

    expect(await normalized([done])).toEqual([done]);
  });

  it('leaves a known event outside the custom lifecycle untouched', async () => {
    const text: ResponsesStreamEvent = {
      type: 'response.output_text.delta',
      output_index: 0,
      delta: 'Sunny.',
    };

    expect(await normalized([text])).toEqual([text]);
  });

  it('leaves an event the dialect does not know untouched', async () => {
    const unknown: ResponsesStreamEvent = { type: 'response.queued' };

    expect(await normalized([unknown])).toEqual([unknown]);
  });
});
