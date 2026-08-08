import { describe, expect, it } from 'vitest';

import type { InteractionsStreamEvent } from './interactions-wire';
import type { ResponsesStreamEvent } from './responses-wire';

import { translateResponse, translateStream } from './dispatcher';

describe('Responses incomplete terminals crossing Interactions', () => {
  it('should preserve incomplete status and aggregate usage without streaming', () => {
    const translated = translateResponse('responses', 'interactions', {
      id: 'resp_1',
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [],
      usage: { input_tokens: 1, output_tokens: 2 },
    });

    if ('outcome' in translated || 'refusal' in translated) {
      throw new Error('expected translated response');
    }

    expect(translated.value.status).toBe('incomplete');
    expect(translated.value.usage).toMatchObject({ total_tokens: 3 });
  });

  it('should terminate an incomplete stream with completed and done events', async () => {
    const events = await translatedStream([
      {
        type: 'response.incomplete',
        response: {
          id: 'resp_1',
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' },
          output: [],
          usage: { input_tokens: 1, output_tokens: 2 },
        },
      },
    ]);

    expect(eventNames(events)).toEqual(['interaction.completed', 'done']);
    expect(events[0]).toHaveProperty('interaction.status', 'incomplete');
    expect(events[0]).toHaveProperty('interaction.usage.total_tokens', 3);
  });
});

describe('Responses terminal output crossing Interactions', () => {
  it('should synthesize completed output when no incremental blocks arrived', async () => {
    const events = await translatedStream([
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
    const events = await translatedStream([
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
        id: 'fc_call_1',
        call_id: 'call_1',
        name: 'lookup',
        arguments: '{}',
      },
    });
  });
});

describe('Responses duplicate terminal payloads crossing Interactions', () => {
  it('should not repeat text or arguments already streamed as deltas', async () => {
    const events = await translatedStream([
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

describe('Responses duplicate function arguments crossing Interactions', () => {
  it('should emit arguments once when done repeats an earlier delta', async () => {
    const events = await translatedStream([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'lookup' },
      },
      { type: 'response.function_call_arguments.delta', output_index: 0, delta: '{"q":"x"}' },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          type: 'function_call',
          id: 'fc_1',
          call_id: 'call_1',
          name: 'lookup',
          arguments: '{"q":"x"}',
        },
      },
    ]);

    const argumentDeltas = events.filter(isArgumentDeltaEvent);

    expect(argumentDeltas).toEqual([
      {
        event_type: 'step.delta',
        index: 0,
        delta: { type: 'arguments_delta', arguments: '{"q":"x"}' },
      },
    ]);
  });
});

describe('Responses created lifecycle crossing Interactions', () => {
  it('should create and start a text step before an unannounced delta', async () => {
    const events = await translatedStream([
      {
        type: 'response.created',
        response: { id: 'resp_1', model: 'gpt-test', status: 'in_progress', output: [] },
      },
      { type: 'response.output_text.delta', output_index: 0, delta: 'hi' },
      {
        type: 'response.completed',
        response: { id: 'resp_1', model: 'gpt-test', status: 'completed', output: [] },
      },
    ]);

    expect(eventNames(events).slice(0, 4)).toEqual([
      'interaction.created',
      'interaction.status_update',
      'step.start',
      'step.delta',
    ]);
    expect(events[1]).toHaveProperty('interaction.id', 'resp_1');
  });
});

// Helpers

async function translatedStream(source: readonly ResponsesStreamEvent[]) {
  const result = translateStream('responses', 'interactions', streamOf(source));

  if ('outcome' in result) throw new Error('expected translated stream');

  const events = [];

  for await (const event of result.stream) events.push(event);

  return events;
}

function eventNames(events: readonly { event_type: string }[]): string[] {
  return events.map((event) => event.event_type);
}

function isArgumentDeltaEvent(event: InteractionsStreamEvent): boolean {
  return (
    event.event_type === 'step.delta' && JSON.stringify(event).includes('"type":"arguments_delta"')
  );
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
