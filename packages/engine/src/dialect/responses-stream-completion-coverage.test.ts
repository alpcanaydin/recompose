import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';
import type { ResponsesOutputItem, ResponsesStreamEvent } from './responses-wire';

import { decodeStream } from './responses-stream';
import { collect, streamOf } from './responses.testkit';

function aStreamEndingWith(
  output: readonly ResponsesOutputItem[],
  ...before: readonly ResponsesStreamEvent[]
): readonly ResponsesStreamEvent[] {
  return [
    { type: 'response.created', response: { id: 'resp_1', status: 'in_progress', output: [] } },
    ...before,
    { type: 'response.completed', response: { id: 'resp_1', status: 'completed', output } },
  ];
}

async function hubEventsOf(
  events: readonly ResponsesStreamEvent[],
): Promise<readonly HubStreamEvent[]> {
  const decoded = await collect(decodeStream(streamOf(events)));

  return decoded;
}

describe('decodeStream: the terminal response replays an item the stream never opened', () => {
  it('replays a reasoning summary as a thinking block', async () => {
    const events = await hubEventsOf(
      aStreamEndingWith([
        { type: 'reasoning', id: 'rs_1', summary: [{ type: 'summary_text', text: 'weighing' }] },
      ]),
    );

    expect(events).toContainEqual({ type: 'block-open', index: 0, opening: { kind: 'thinking' } });
    expect(events).toContainEqual({
      type: 'block-delta',
      index: 0,
      delta: { kind: 'thinking', text: 'weighing' },
    });
    expect(events).toContainEqual({ type: 'block-close', index: 0 });
  });

  it('opens and closes a reasoning item that summarized nothing', async () => {
    const events = await hubEventsOf(aStreamEndingWith([{ type: 'reasoning', id: 'rs_1' }]));

    expect(events.filter((event) => event.type === 'block-delta')).toEqual([]);
    expect(events).toContainEqual({ type: 'block-open', index: 0, opening: { kind: 'thinking' } });
  });

  it('opens no block for a generated image the hub stream has no opening for', async () => {
    const events = await hubEventsOf(
      aStreamEndingWith([{ type: 'image_generation_call', id: 'img_1', result: 'ZGF0YQ==' }]),
    );

    expect(events.map((event) => event.type)).toEqual(['message-begin', 'message-end']);
  });
});

describe('decodeStream: the terminal response closes an item the stream already opened', () => {
  it('closes an open text block without replaying the text it already sent', async () => {
    const events = await hubEventsOf(
      aStreamEndingWith(
        [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Sunny.' }],
          },
        ],
        { type: 'response.output_text.delta', output_index: 0, delta: 'Sunny.' },
      ),
    );

    expect(events.filter((event) => event.type === 'block-delta')).toEqual([
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'Sunny.' } },
    ]);
    expect(events).toContainEqual({ type: 'block-close', index: 0 });
  });
});
