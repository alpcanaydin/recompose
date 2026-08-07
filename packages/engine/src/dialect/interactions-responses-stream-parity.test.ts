import { describe, expect, it } from 'vitest';

import type { ResponsesStreamEvent } from './responses-wire';

import { translateStream } from './dispatcher';

describe('Responses terminal output crossing Interactions', () => {
  it('should synthesize completed output when no incremental blocks arrived', async () => {
    const events = await translated([
      {
        type: 'response.completed',
        response: {
          id: 'resp_1',
          status: 'completed',
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'final' }],
            },
            { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{"q":"x"}' },
          ],
          usage: { input_tokens: 1, output_tokens: 2 },
        },
      },
    ]);

    expect(eventNames(events)).toEqual([
      'step.start',
      'step.delta',
      'step.stop',
      'step.start',
      'step.delta',
      'step.stop',
      'interaction.completed',
      'done',
    ]);
    expect(events).toContainEqual({
      event_type: 'step.delta',
      index: 1,
      delta: { type: 'arguments_delta', arguments: '{"q":"x"}' },
    });
  });
});

describe('Responses done-only function calls crossing Interactions', () => {
  it('should open a function call delivered only as output_item.done', async () => {
    const events = await translated([
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          type: 'function_call',
          id: 'fc_1',
          call_id: 'call_stream_1',
          name: 'lookup',
          arguments: '{"q":"x"}',
        },
      },
      {
        type: 'response.completed',
        response: { id: 'resp_1', status: 'completed', output: [] },
      },
    ]);

    expect(events).toContainEqual({
      event_type: 'step.start',
      index: 0,
      step: {
        type: 'function_call',
        id: 'call_stream_1',
        call_id: 'call_stream_1',
        name: 'lookup',
        arguments: {},
      },
    });
  });
});

describe('Interactions empty function calls crossing Responses', () => {
  it('should complete an argument-less call with an empty JSON object', async () => {
    const result = translateStream(
      'interactions',
      'responses',
      streamOf([
        {
          event_type: 'step.start',
          index: 0,
          step: { type: 'function_call', id: 'call_1', name: 'lookup', arguments: {} },
        },
        { event_type: 'step.stop', index: 0 },
        {
          event_type: 'interaction.completed',
          interaction: { id: 'interaction_1', status: 'requires_action' },
        },
      ]),
    );

    if ('outcome' in result) throw new Error('expected translated Responses stream');

    const events = [];

    for await (const event of result.stream) events.push(event);

    expect(events).toContainEqual({
      type: 'response.output_item.done',
      output_index: 0,
      item: {
        type: 'function_call',
        id: 'call_1',
        call_id: 'call_1',
        name: 'lookup',
        arguments: '{}',
      },
    });
  });
});

describe('Responses duplicate terminal payloads crossing Interactions', () => {
  it('should not repeat text or arguments already streamed as deltas', async () => {
    const events = await translated([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'message', role: 'assistant' },
      },
      { type: 'response.output_text.delta', output_index: 0, delta: 'hi' },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          type: 'message',
          id: 'msg_1',
          content: [{ type: 'output_text', text: 'hi' }],
        },
      },
      {
        type: 'response.completed',
        response: {
          id: 'resp_1',
          status: 'completed',
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'hi' }],
            },
          ],
        },
      },
    ]);

    const textDeltas = events.filter((event) => event.event_type === 'step.delta');

    expect(textDeltas).toEqual([
      { event_type: 'step.delta', index: 0, delta: { type: 'text', text: 'hi' } },
    ]);
  });
});

// Helpers

async function translated(source: readonly ResponsesStreamEvent[]) {
  const result = translateStream('responses', 'interactions', streamOf(source));

  if ('outcome' in result) throw new Error('expected translated stream');

  const events = [];

  for await (const event of result.stream) events.push(event);

  return events;
}

function eventNames(events: readonly { event_type: string }[]): string[] {
  return events.map((event) => event.event_type);
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
