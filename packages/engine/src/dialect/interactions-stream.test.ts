import { describe, expect, it } from 'vitest';

import type { InteractionsStreamEvent } from './interactions-wire';

import { decodeStream } from './interactions-stream';

describe('decodeStream: Interactions text lifecycle', () => {
  it('should decode created, text steps, and terminal usage in order', async () => {
    const events = await decode([
      {
        event_type: 'interaction.created',
        interaction: { id: 'interaction_1', model: 'gemini-3.1-flash-lite' },
      },
      { event_type: 'step.start', index: 0, step: { type: 'model_output', content: [] } },
      { event_type: 'step.delta', index: 0, delta: { type: 'text', text: '北京今天晴' } },
      { event_type: 'step.stop', index: 0 },
      {
        event_type: 'interaction.completed',
        interaction: {
          id: 'interaction_1',
          status: 'completed',
          usage: { total_input_tokens: 3, total_output_tokens: 4 },
        },
      },
    ]);

    expect(events).toEqual([
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: '北京今天晴' } },
      { type: 'block-close', index: 0 },
      {
        type: 'message-end',
        stopReason: 'end',
        usage: { inputTokens: 3, outputTokens: 4 },
      },
    ]);
  });
});

describe('decodeStream: Interactions function-call lifecycle', () => {
  it('should preserve call identity, signature, arguments, and idempotent boundaries', async () => {
    const events = await decode(toolLifecycle());

    expect(events).toEqual(expectedToolLifecycle());
  });
});

describe('decodeStream: Interactions thought deltas', () => {
  it('should preserve thought summaries and the final non-empty signature', async () => {
    const events = await decode([
      { event_type: 'interaction.created', interaction: { id: 'interaction_1' } },
      { event_type: 'step.start', index: 0, step: { type: 'thought', content: [] } },
      {
        event_type: 'step.delta',
        index: 0,
        delta: { type: 'thought_summary', content: { type: 'text', text: 'thinking' } },
      },
      {
        event_type: 'step.delta',
        index: 0,
        delta: { type: 'thought_signature', signature: '' },
      },
      {
        event_type: 'step.delta',
        index: 0,
        delta: { type: 'thought_signature', signature: 'sig_final' },
      },
      { event_type: 'step.stop', index: 0 },
    ]);

    expect(events).toContainEqual({
      type: 'block-delta',
      index: 0,
      delta: { kind: 'thinking', text: 'thinking' },
    });
    expect(events).toContainEqual({
      type: 'block-delta',
      index: 0,
      delta: { kind: 'signature', signature: 'sig_final' },
    });
  });
});

describe('decodeStream: Interactions alternate terminals', () => {
  it('should finish with metadata usage when no completed event is sent', async () => {
    const events = await decode([
      { event_type: 'interaction.created', interaction: { id: 'interaction_1' } },
      {
        event_type: 'finish',
        metadata: { total_usage: { total_input_tokens: 2, total_output_tokens: 6 } },
      },
    ]);

    expect(events.at(-1)).toEqual({
      type: 'message-end',
      stopReason: 'end',
      usage: { inputTokens: 2, outputTokens: 6 },
    });
  });

  it('should expose a failed interaction as a terminal stream error', async () => {
    const events = await decode([
      {
        event_type: 'interaction.failed',
        interaction: {
          id: 'interaction_1',
          error: { type: 'overloaded_error', message: 'try later' },
        },
      },
    ]);

    expect(events).toEqual([
      { type: 'stream-error', error: { type: 'overloaded_error', message: 'try later' } },
    ]);
  });
});

// Helpers

async function decode(events: readonly InteractionsStreamEvent[]) {
  const decoded = [];

  for await (const event of decodeStream(streamOf(events))) decoded.push(event);

  return decoded;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}

function toolLifecycle(): InteractionsStreamEvent[] {
  const start: InteractionsStreamEvent = {
    event_type: 'step.start',
    index: 0,
    step: {
      type: 'function_call',
      id: 'toolu_1',
      name: 'get_weather',
      arguments: {},
      signature: 'sig_1',
    },
  };
  const stop: InteractionsStreamEvent = { event_type: 'step.stop', index: 0 };

  return [
    { event_type: 'interaction.created', interaction: { id: 'interaction_1' } },
    start,
    start,
    {
      event_type: 'step.delta',
      index: 0,
      delta: { type: 'arguments_delta', arguments: '{"location":"北京"}' },
    },
    stop,
    stop,
    {
      event_type: 'interaction.completed',
      interaction: {
        id: 'interaction_1',
        status: 'requires_action',
        usage: { total_input_tokens: 1, total_output_tokens: 2 },
      },
    },
  ];
}

function expectedToolLifecycle() {
  return [
    { type: 'message-begin' },
    {
      type: 'block-open',
      index: 0,
      opening: { kind: 'tool', id: 'toolu_1', name: 'get_weather', signature: 'sig_1' },
    },
    {
      type: 'block-delta',
      index: 0,
      delta: { kind: 'json-args', partialJson: '{"location":"北京"}' },
    },
    { type: 'block-close', index: 0 },
    {
      type: 'message-end',
      stopReason: 'tool_use',
      usage: { inputTokens: 1, outputTokens: 2 },
    },
  ];
}
