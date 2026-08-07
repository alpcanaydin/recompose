import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';

import { encodeStream } from './interactions-stream-encode';

describe('encodeStream: Hub text lifecycle to Interactions', () => {
  it('should emit created, status, step, and completed events', async () => {
    const encoded = await encode([
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'hello' } },
      { type: 'block-close', index: 0 },
      {
        type: 'message-end',
        stopReason: 'end',
        usage: { inputTokens: 2, outputTokens: 3 },
      },
    ]);

    expect(encoded).toEqual([
      {
        event_type: 'interaction.created',
        interaction: { id: 'interaction_translated', status: 'created' },
      },
      {
        event_type: 'interaction.status_update',
        interaction: { id: 'interaction_translated', status: 'in_progress' },
      },
      {
        event_type: 'step.start',
        index: 0,
        step: { type: 'model_output', content: [] },
      },
      { event_type: 'step.delta', index: 0, delta: { type: 'text', text: 'hello' } },
      { event_type: 'step.stop', index: 0, status: 'done' },
      {
        event_type: 'interaction.completed',
        interaction: {
          id: 'interaction_translated',
          status: 'completed',
          usage: { total_input_tokens: 2, total_output_tokens: 3 },
        },
      },
    ]);
  });
});

describe('encodeStream: Hub tool and thought deltas to Interactions', () => {
  it('should preserve tool signatures, partial arguments, and requires-action status', async () => {
    const encoded = await encode([
      { type: 'message-begin' },
      {
        type: 'block-open',
        index: 0,
        opening: { kind: 'tool', id: 'call_1', name: 'lookup', signature: 'sig_1' },
      },
      { type: 'block-delta', index: 0, delta: { kind: 'json-args', partialJson: '{"q":"x"}' } },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'tool_use', usage: {} },
    ]);

    expect(encoded).toContainEqual({
      event_type: 'step.start',
      index: 0,
      step: {
        type: 'function_call',
        id: 'call_1',
        call_id: 'call_1',
        name: 'lookup',
        arguments: {},
        signature: 'sig_1',
      },
    });
    expect(encoded).toContainEqual({
      event_type: 'step.delta',
      index: 0,
      delta: { type: 'arguments_delta', arguments: '{"q":"x"}' },
    });
    expect(encoded.at(-1)).toHaveProperty('interaction.status', 'requires_action');
  });
});

describe('encodeStream: Hub thought deltas to Interactions', () => {
  it('should preserve thought summaries and signatures', async () => {
    const encoded = await encode([
      { type: 'block-open', index: 0, opening: { kind: 'thinking' } },
      { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'consider' } },
      { type: 'block-delta', index: 0, delta: { kind: 'signature', signature: 'sig_1' } },
      { type: 'block-close', index: 0 },
    ]);

    expect(encoded).toContainEqual({
      event_type: 'step.delta',
      index: 0,
      delta: { type: 'thought_summary', content: { type: 'text', text: 'consider' } },
    });
    expect(encoded).toContainEqual({
      event_type: 'step.delta',
      index: 0,
      delta: { type: 'thought_signature', signature: 'sig_1' },
    });
  });
});

// Helpers

async function encode(events: readonly HubStreamEvent[]) {
  const encoded = [];

  for await (const event of encodeStream(streamOf(events))) encoded.push(event);

  return encoded;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
