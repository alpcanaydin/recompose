import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';
import type { ResponsesStreamEvent } from './responses-wire';

import { decodeStream } from './responses-stream';

async function collected(source: AsyncIterable<ResponsesStreamEvent>): Promise<HubStreamEvent[]> {
  const held: HubStreamEvent[] = [];

  for await (const event of decodeStream(source)) held.push(event);

  return held;
}

async function* streaming(
  events: readonly ResponsesStreamEvent[],
): AsyncIterable<ResponsesStreamEvent> {
  await Promise.resolve();

  for (const event of events) yield event;
}

function vanishingSource(): AsyncIterable<ResponsesStreamEvent> {
  return new ReadableStream<ResponsesStreamEvent>({
    start(controller) {
      controller.error();
    },
  });
}

describe('a Responses stream that completes while still marked in progress', () => {
  it('ends the message as completed rather than repeating the running status', async () => {
    const events = await collected(
      streaming([
        {
          type: 'response.completed',
          response: { id: 'r', status: 'in_progress', output: [] },
        },
      ]),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'message-end', stopReason: 'end' }),
    );
  });
});

describe('a Responses stream that fails without naming its error', () => {
  it('reports a generic upstream API error', async () => {
    const events = await collected(
      streaming([{ type: 'response.failed', response: { id: 'r', status: 'failed', output: [] } }]),
    );

    expect(events).toEqual([
      {
        type: 'stream-error',
        error: { type: 'api_error', message: 'Codex response failed' },
      },
    ]);
  });
});

describe('a Responses stream whose source dies without naming a reason', () => {
  it('reports the upstream stream failure in its own words', async () => {
    const events = await collected(vanishingSource());

    expect(events).toEqual([
      {
        type: 'stream-error',
        error: { type: 'upstream_stream_error', message: 'Codex upstream stream failed' },
      },
    ]);
  });
});
