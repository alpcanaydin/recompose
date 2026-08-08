import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';
import type { InteractionsStreamEvent } from './interactions-wire';

import { decodeStream } from './interactions-stream';

async function* streamed(events: readonly InteractionsStreamEvent[]) {
  await Promise.resolve();

  for (const event of events) yield event;
}

async function decode(events: readonly InteractionsStreamEvent[]): Promise<HubStreamEvent[]> {
  const decoded: HubStreamEvent[] = [];

  for await (const event of decodeStream(streamed(events))) decoded.push(event);

  return decoded;
}

describe('decodeStream: events that carry no hub meaning', () => {
  it('should ignore an event type it does not speak and a bare status update', async () => {
    const events = await decode([
      { event_type: 'interaction.telemetry' },
      { event_type: 'interaction.status_update', interaction: { status: 'in_progress' } },
      { event_type: 'done' },
    ]);

    expect(events).toEqual([{ type: 'message-end', stopReason: 'end', usage: {} }]);
  });

  it('should open no block for a step that produces no content', async () => {
    const events = await decode([
      {
        event_type: 'step.start',
        index: 0,
        step: { type: 'function_result', call_id: 'call_1', result: { ok: true } },
      },
      { event_type: 'step.delta', index: 4, delta: { type: 'text', text: 'orphan' } },
      { event_type: 'done' },
    ]);

    expect(events).toEqual([{ type: 'message-end', stopReason: 'end', usage: {} }]);
  });
});

describe('decodeStream: identifying a tool call', () => {
  it('should key a call by its name when the step carries no identifier', async () => {
    const events = await decode([
      {
        event_type: 'step.start',
        index: 0,
        step: { type: 'function_call', name: 'Read', arguments: '{"path":"/tmp/a"}' },
      },
      { event_type: 'done' },
    ]);

    expect(events).toEqual([
      { type: 'block-open', index: 0, opening: { kind: 'tool', id: 'Read', name: 'Read' } },
      {
        type: 'block-delta',
        index: 0,
        delta: { kind: 'json-args', partialJson: '{"path":"/tmp/a"}' },
      },
      { type: 'message-end', stopReason: 'tool_use', usage: {} },
    ]);
  });
});

describe('decodeStream: how an interaction ends', () => {
  it('should end at the output limit when the interaction is incomplete', async () => {
    const events = await decode([
      { event_type: 'interaction.completed', interaction: { status: 'incomplete' } },
    ]);

    expect(events).toEqual([{ type: 'message-end', stopReason: 'max_output', usage: {} }]);
  });

  it('should end as a refusal when the interaction reports failure', async () => {
    const events = await decode([
      { event_type: 'interaction.completed', interaction: { status: 'failed' } },
    ]);

    expect(events).toEqual([{ type: 'message-end', stopReason: 'refusal', usage: {} }]);
  });

  it('should describe a failure that arrives with no error detail', async () => {
    const events = await decode([{ event_type: 'interaction.failed', interaction: {} }]);

    expect(events).toEqual([
      {
        type: 'stream-error',
        error: { type: 'interactions_error', message: 'The interaction failed.' },
      },
    ]);
  });
});

describe('decodeStream: beginning the message', () => {
  it('should begin once and without identity when creation repeats and names nothing', async () => {
    const events = await decode([
      { event_type: 'interaction.created', interaction: {} },
      { event_type: 'interaction.created', interaction: { id: 'interaction_2' } },
      { event_type: 'done' },
    ]);

    expect(events).toEqual([
      { type: 'message-begin' },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ]);
  });
});
