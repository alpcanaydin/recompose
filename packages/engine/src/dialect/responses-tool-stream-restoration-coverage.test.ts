import { describe, expect, test } from 'vitest';

import type { ResponsesToolRef } from './responses-extended-tools';
import type { ResponsesStreamEvent } from './responses-wire';

import { restoreResponsesToolStream } from './responses-tool-stream-restoration';

const CUSTOM_REFS: Record<string, ResponsesToolRef> = {
  Shell: { kind: 'custom', name: 'shell' },
};

const NAMESPACE_REFS: Record<string, ResponsesToolRef> = {
  ns__Read: { kind: 'namespace', namespace: 'ns', name: 'Read' },
};

async function* streamed(events: readonly ResponsesStreamEvent[]) {
  await Promise.resolve();

  for (const event of events) yield event;
}

async function restored(
  events: readonly ResponsesStreamEvent[],
  refs: Record<string, ResponsesToolRef>,
): Promise<ResponsesStreamEvent[]> {
  const collected: ResponsesStreamEvent[] = [];

  for await (const event of restoreResponsesToolStream(streamed(events), refs)) {
    collected.push(event);
  }

  return collected;
}

describe('restoring a custom tool call as it streams', () => {
  test('a call identified only by its item id keys the restored call by that id', async () => {
    const events = await restored(
      [
        {
          type: 'response.output_item.added',
          output_index: 0,
          item: { type: 'function_call', name: 'Shell', id: 'fc_1' },
        },
        {
          type: 'response.function_call_arguments.done',
          output_index: 0,
          arguments: '{"input":"ls"}',
        },
      ],
      CUSTOM_REFS,
    );

    expect(events[0]).toHaveProperty('item.id', 'ctc_fc_1');
    expect(events[0]).toHaveProperty('item.name', 'shell');
    expect(events[1]).toStrictEqual({
      type: 'response.custom_tool_call_input.done',
      output_index: 0,
      item_id: 'ctc_fc_1',
      input: 'ls',
    });
  });

  test('a call carrying no identifier at all still restores under a bare prefix', async () => {
    const events = await restored(
      [
        {
          type: 'response.output_item.added',
          output_index: 0,
          item: { type: 'function_call', name: 'Shell' },
        },
      ],
      CUSTOM_REFS,
    );

    expect(events[0]).toHaveProperty('item.id', 'ctc_');
  });
});

describe('restoring a namespaced tool call as it streams', () => {
  test('a call carrying no item id still recovers its namespace and short name', async () => {
    const events = await restored(
      [
        {
          type: 'response.output_item.added',
          output_index: 0,
          item: { type: 'function_call', name: 'ns__Read' },
        },
      ],
      NAMESPACE_REFS,
    );

    expect(events[0]).toHaveProperty('item.name', 'Read');
    expect(events[0]).toHaveProperty('item.namespace', 'ns');
  });
});

describe('passing through a stream event that names no item', () => {
  test('an item-done event with nothing to restore is forwarded as it arrived', async () => {
    const events = await restored(
      [{ type: 'response.output_item.done', output_index: 0 }],
      CUSTOM_REFS,
    );

    expect(events).toStrictEqual([{ type: 'response.output_item.done', output_index: 0 }]);
  });
});
