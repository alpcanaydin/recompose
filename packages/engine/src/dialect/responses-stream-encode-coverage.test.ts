import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';
import type { ResponsesStreamEvent } from './responses-wire';

import { encodeStream } from './responses-stream-encode';

async function* hubStream(events: readonly HubStreamEvent[]): AsyncIterable<HubStreamEvent> {
  for (const event of events) {
    await Promise.resolve();

    yield event;
  }
}

async function encoded(events: readonly HubStreamEvent[]): Promise<ResponsesStreamEvent[]> {
  const collected: ResponsesStreamEvent[] = [];

  for await (const event of encodeStream(hubStream(events))) {
    collected.push(event);
  }

  return collected;
}

describe('encoding a hub stream the Responses dialect cannot carry', () => {
  it('should drop a media block the Responses wire has no item for', async () => {
    const events = await encoded([
      { type: 'message-begin', id: 'resp_1' },
      {
        type: 'media',
        block: { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: 'AA==' } },
      },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ]);

    expect(events.map((event) => event.type)).toEqual(['response.created', 'response.completed']);
  });
});

describe('encoding a hub stream whose blocks never opened', () => {
  it('should key a delta for an unopened block to its own index', async () => {
    const events = await encoded([
      { type: 'message-begin', id: 'resp_2' },
      { type: 'block-delta', index: 4, delta: { kind: 'text', text: 'stray' } },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ]);

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'response.output_text.delta', output_index: 4 }),
    );
  });

  it('should close an unopened block without describing an item', async () => {
    const events = await encoded([
      { type: 'message-begin', id: 'resp_3' },
      { type: 'block-close', index: 7 },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ]);

    expect(events).toContainEqual({ type: 'response.output_item.done', output_index: 7 });
  });
});
