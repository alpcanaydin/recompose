import { describe, expect, it } from 'vitest';

import type { ChatStreamFrame, ChatToolCallDelta } from './chat-completions-wire';
import type { HubStreamEvent } from './hub';

import { decodeStream } from './chat-completions-stream-decode';

describe('Chat tool names crossing Claude streams', () => {
  it.each([[''], [null], [123]])('should suppress an invalid tool name: %j', async (name) => {
    const events = await decoded([
      toolChunk([{ index: 0, id: 'call_a', function: { name, arguments: '{}' } }]),
      finishChunk(),
    ]);

    expect(toolOpens(events)).toEqual([]);
    expect(lastStop(events)).not.toBe('tool_use');
  });

  it('should ignore a null repeated name after a valid tool start', async () => {
    const events = await decoded([
      toolChunk([{ index: 0, id: 'call_a', function: { name: 'read_file', arguments: '' } }]),
      toolChunk([{ index: 0, function: { name: null, arguments: '{"path":"a"}' } }]),
      finishChunk(),
    ]);

    expect(toolOpens(events)).toHaveLength(1);
    expect(toolOpens(events)[0]).toHaveProperty('opening.name', 'read_file');
  });

  it('should emit a repeated valid name only once', async () => {
    const events = await decoded([
      toolChunk([{ index: 0, id: 'call_a', function: { name: 'do_it', arguments: '' } }]),
      toolChunk([{ index: 0, function: { name: 'do_it', arguments: '{"x":1}' } }]),
      finishChunk(),
    ]);

    expect(toolOpens(events)).toHaveLength(1);
    expect(events.filter((event) => event.type === 'block-close')).toHaveLength(1);
  });

  it('should emit only the valid member of mixed tool deltas', async () => {
    const events = await decoded([
      toolChunk([
        { index: 0, id: 'call_skip', function: { name: '', arguments: '' } },
        { index: 1, id: 'call_real', function: { name: 'do_it', arguments: '{}' } },
      ]),
      finishChunk(),
    ]);

    expect(toolOpens(events).map((event) => event.opening)).toEqual([
      { kind: 'tool', id: 'call_real', name: 'do_it' },
    ]);
    expect(lastStop(events)).toBe('tool_use');
  });
});

describe('Late Chat tool identity crossing Claude streams', () => {
  it('should defer a tool until its ID arrives in a function-less delta', async () => {
    const events = await decoded([
      toolChunk([{ index: 0, id: '', function: { name: 'do_it', arguments: '{}' } }]),
      toolChunk([{ index: 0, id: 'call_real' }]),
      finishChunk(),
    ]);

    expect(toolOpens(events)[0]).toHaveProperty('opening', {
      kind: 'tool',
      id: 'call_real',
      name: 'do_it',
    });
  });

  it('should synthesize an ID at finish when a valid tool never receives one', async () => {
    const events = await decoded([
      toolChunk([{ index: 0, function: { name: 'do_it', arguments: '{}' } }]),
      finishChunk(),
    ]);
    const opening = toolOpens(events)[0]?.opening;

    expect(opening?.kind).toBe('tool');
    expect(opening?.kind === 'tool' ? opening.id : '').toMatch(/^toolu_/u);
    expect(lastStop(events)).toBe('tool_use');
  });

  it('should flush belated starts in OpenAI tool-index order', async () => {
    const events = await decoded([
      toolChunk([
        { index: 2, function: { name: 'third_tool', arguments: '{}' } },
        { index: 0, function: { name: 'first_tool', arguments: '{}' } },
        { index: 1, function: { name: 'second_tool', arguments: '{}' } },
      ]),
      finishChunk(),
    ]);

    expect(toolOpens(events).map((event) => event.opening.name)).toEqual([
      'first_tool',
      'second_tool',
      'third_tool',
    ]);
    expect(toolOpens(events).map((event) => event.index)).toEqual([0, 1, 2]);
  });

  it('should ignore an ID arriving after tool finalization', async () => {
    const events = await decoded([
      toolChunk([{ index: 0, function: { name: 'do_it' } }]),
      finishChunk(),
      toolChunk([{ index: 0, id: 'call_late' }]),
    ]);

    expect(toolOpens(events)).toHaveLength(1);
  });
});

function toolChunk(toolCalls: readonly ChatToolCallDelta[]): ChatStreamFrame {
  return {
    type: 'chunk',
    chunk: { choices: [{ index: 0, delta: { tool_calls: toolCalls }, finish_reason: null }] },
  };
}

function finishChunk(): ChatStreamFrame {
  return {
    type: 'chunk',
    chunk: { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
  };
}

async function decoded(frames: readonly ChatStreamFrame[]) {
  const events: HubStreamEvent[] = [];

  for await (const event of decodeStream(streamOf([...frames, { type: 'done' }]))) {
    events.push(event);
  }

  return events;
}

function toolOpens(events: readonly HubStreamEvent[]) {
  return events.filter(
    (
      event,
    ): event is Extract<HubStreamEvent, { type: 'block-open' }> & {
      opening: Extract<
        Extract<HubStreamEvent, { type: 'block-open' }>['opening'],
        { kind: 'tool' }
      >;
    } => event.type === 'block-open' && event.opening.kind === 'tool',
  );
}

function lastStop(events: readonly HubStreamEvent[]) {
  const end = events.findLast((event) => event.type === 'message-end');

  return end?.type === 'message-end' ? end.stopReason : undefined;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
