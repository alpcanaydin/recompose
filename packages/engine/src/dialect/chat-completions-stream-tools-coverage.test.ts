import { describe, expect, it } from 'vitest';

import type { ChatStreamFrame } from './chat-completions-wire';
import type { HubStreamEvent } from './hub';

import { decodeStreamForResponses } from './chat-completions-stream-decode';

async function* chatStream(frames: readonly ChatStreamFrame[]): AsyncIterable<ChatStreamFrame> {
  for (const frame of frames) {
    await Promise.resolve();

    yield frame;
  }
}

function openedToolIds(events: readonly HubStreamEvent[]): string[] {
  return events.flatMap((event) =>
    event.type === 'block-open' && event.opening.kind === 'tool' ? [event.opening.id] : [],
  );
}

async function collected(source: AsyncIterable<HubStreamEvent>): Promise<HubStreamEvent[]> {
  const events: HubStreamEvent[] = [];

  for await (const event of source) {
    events.push(event);
  }

  return events;
}

describe('naming a Responses tool call the chat stream left anonymous', () => {
  it('should fall back to a generic response id when the chunk names none', async () => {
    const events = await collected(
      decodeStreamForResponses(
        chatStream([
          {
            type: 'chunk',
            chunk: {
              choices: [
                {
                  index: 0,
                  delta: { tool_calls: [{ index: 0, function: { name: 'Bash' } }] },
                  finish_reason: 'tool_calls',
                },
              ],
            },
          },
          { type: 'done' },
        ]),
      ),
    );

    expect(openedToolIds(events)).toEqual(['call_chatcmpl_0_0']);
  });
});
