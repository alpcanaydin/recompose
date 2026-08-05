import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import type { ChatStreamFrame, ChatToolCallDelta } from './chat-completions-wire';
import type { HubStreamEvent } from './hub';

import { decodeStream } from './chat-completions-stream';
import {
  aChatTextThenToolStream,
  aChatToolCallChunkStream,
  collect,
  streamOf,
} from './chat-completions.testkit';

function toolOpens(events: readonly HubStreamEvent[]) {
  return events.filter(
    (event): event is Extract<HubStreamEvent, { type: 'block-open' }> =>
      event.type === 'block-open',
  );
}

describe('decodeStream folds Chat Completions chunks into hub events', () => {
  it('carries the tool name and a stable id onto the tool block open', async () => {
    const events = await collect(decodeStream(streamOf(aChatToolCallChunkStream())));

    const open = toolOpens(events)[0]?.opening;

    expect(open).toEqual({ kind: 'tool', id: 'call_weather', name: 'get_weather' });
  });

  it('ends a clean stream in the hub terminator carrying the deferred usage', async () => {
    const events = await collect(decodeStream(streamOf(aChatToolCallChunkStream())));

    const begin = events.find((event) => event.type === 'message-begin');
    const end = events.at(-1);

    expect(begin).toEqual({ type: 'message-begin' });
    expect(end).toEqual({
      type: 'message-end',
      stopReason: 'tool_use',
      usage: { inputTokens: 12, outputTokens: 5 },
    });
  });

  it('counts every block in the hub index, so text sits at 0 and the tool at 1', async () => {
    const events = await collect(decodeStream(streamOf(aChatTextThenToolStream())));

    const opens = toolOpens(events);

    expect(opens.map((event) => ({ index: event.index, kind: event.opening.kind }))).toEqual([
      { index: 0, kind: 'text' },
      { index: 1, kind: 'tool' },
    ]);
  });

  it('synthesizes a stable id when the upstream tool chunk omits it', async () => {
    const frames: readonly ChatStreamFrame[] = [
      {
        type: 'chunk',
        chunk: {
          choices: [
            { index: 0, delta: { tool_calls: [{ function: { name: 'ping', arguments: '{}' } }] } },
          ],
        },
      },
      { type: 'chunk', chunk: { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] } },
      { type: 'done' },
    ];

    const open = toolOpens(await collect(decodeStream(streamOf(frames))))[0]?.opening;

    expect(open?.kind).toBe('tool');
    expect(open?.kind === 'tool' ? open.id.length : 0).toBeGreaterThan(0);
  });
});

describe('decodeStream carries failures and unknown events without a synthetic success', () => {
  it('maps a mid-stream error to a terminal stream-error event and stops', async () => {
    const frames: readonly ChatStreamFrame[] = [
      { type: 'chunk', chunk: { choices: [{ index: 0, delta: { content: 'partial' } }] } },
      { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
      { type: 'chunk', chunk: { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] } },
      { type: 'done' },
    ];

    const events = await collect(decodeStream(streamOf(frames)));

    expect(events.at(-1)).toEqual({
      type: 'stream-error',
      error: { type: 'overloaded_error', message: 'Overloaded' },
    });
    expect(events.some((event) => event.type === 'message-end')).toBe(false);
  });

  it('passes an unrecognized frame through without ending the stream', async () => {
    const frames: readonly ChatStreamFrame[] = [
      { type: 'unknown' },
      { type: 'chunk', chunk: { choices: [{ index: 0, delta: { content: 'hello' } }] } },
      { type: 'chunk', chunk: { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] } },
      { type: 'done' },
    ];

    const events = await collect(decodeStream(streamOf(frames)));

    expect(events.at(-1)?.type).toBe('message-end');
  });
});

describe('decodeStream opens one text block across consecutive content deltas', () => {
  it('reuses the open text block rather than opening a second one', async () => {
    const frames: readonly ChatStreamFrame[] = [
      { type: 'chunk', chunk: { choices: [{ index: 0, delta: { content: 'a' } }] } },
      { type: 'chunk', chunk: { choices: [{ index: 0, delta: { content: 'b' } }] } },
      { type: 'chunk', chunk: { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] } },
      { type: 'done' },
    ];

    const events = await collect(decodeStream(streamOf(frames)));

    expect(events.filter((event) => event.type === 'block-open')).toHaveLength(1);
  });
});

describe('decodeStream folds the Chat Completions stream into exact hub sequences', () => {
  it('decodes the tool-call stream into the exact hub events', async () => {
    const events = await collect(decodeStream(streamOf(aChatToolCallChunkStream())));

    expect(events).toEqual([
      { type: 'message-begin' },
      {
        type: 'block-open',
        index: 0,
        opening: { kind: 'tool', id: 'call_weather', name: 'get_weather' },
      },
      {
        type: 'block-delta',
        index: 0,
        delta: { kind: 'json-args', partialJson: '{"city":"Paris"}' },
      },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'tool_use', usage: { inputTokens: 12, outputTokens: 5 } },
    ]);
  });

  it('decodes text before a tool call into ordered, closed hub blocks', async () => {
    const events = await collect(decodeStream(streamOf(aChatTextThenToolStream())));

    expect(events).toEqual([
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'Let me check. ' } },
      { type: 'block-close', index: 0 },
      {
        type: 'block-open',
        index: 1,
        opening: { kind: 'tool', id: 'call_weather', name: 'get_weather' },
      },
      { type: 'block-delta', index: 1, delta: { kind: 'json-args', partialJson: '{}' } },
      { type: 'block-close', index: 1 },
      { type: 'message-end', stopReason: 'tool_use', usage: {} },
    ]);
  });
});

function toToolDelta(fields: {
  id?: string;
  name?: string;
  index?: number;
  args: string;
}): ChatToolCallDelta {
  return {
    ...(fields.index !== undefined ? { index: fields.index } : {}),
    ...(fields.id !== undefined ? { id: fields.id } : {}),
    function: {
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      arguments: fields.args,
    },
  };
}

const arbitraryToolFields = fc.record(
  {
    id: fc.string({ maxLength: 6 }),
    name: fc.string({ maxLength: 6 }),
    index: fc.nat({ max: 2 }),
    args: fc.string({ maxLength: 8 }),
  },
  { requiredKeys: ['args'] },
);

describe('a decoded stream never opens a tool block without a name and an id', () => {
  test.prop([fc.array(arbitraryToolFields, { minLength: 1, maxLength: 6 })])(
    'every tool block open the fold emits carries a non-empty name and id',
    async (fieldsList) => {
      const frames: ChatStreamFrame[] = fieldsList.map((fields) => ({
        type: 'chunk',
        chunk: { choices: [{ index: 0, delta: { tool_calls: [toToolDelta(fields)] } }] },
      }));

      const events = await collect(decodeStream(streamOf([...frames, { type: 'done' }])));

      for (const open of toolOpens(events)) {
        if (open.opening.kind === 'tool') {
          expect(open.opening.name.length).toBeGreaterThan(0);
          expect(open.opening.id.length).toBeGreaterThan(0);
        }
      }
    },
  );
});
