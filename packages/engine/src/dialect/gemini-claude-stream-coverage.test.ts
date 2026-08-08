import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';

import { mergeGeminiThinkingSignature } from './gemini-claude-stream';

async function* streamOf(events: readonly HubStreamEvent[]): AsyncIterable<HubStreamEvent> {
  await Promise.resolve();

  for (const event of events) yield event;
}

async function merged(events: readonly HubStreamEvent[]): Promise<HubStreamEvent[]> {
  const collected: HubStreamEvent[] = [];

  for await (const event of mergeGeminiThinkingSignature(streamOf(events))) collected.push(event);

  return collected;
}

const thinkingOpen: HubStreamEvent = {
  type: 'block-open',
  index: 0,
  opening: { kind: 'thinking' },
};
const thinkingClose: HubStreamEvent = { type: 'block-close', index: 0 };
const textOpen: HubStreamEvent = { type: 'block-open', index: 1, opening: { kind: 'text' } };
const textClose: HubStreamEvent = { type: 'block-close', index: 1 };

describe('mergeGeminiThinkingSignature: a stream that never opens a thinking block', () => {
  it('passes every event through in the order it arrived', async () => {
    const events: readonly HubStreamEvent[] = [
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'Sunny.' } },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ];

    expect(await merged(events)).toEqual(events);
  });
});

describe('mergeGeminiThinkingSignature: a text block that carries no signature', () => {
  it('releases the held thinking close and the text block when another event arrives', async () => {
    const events: readonly HubStreamEvent[] = [
      thinkingOpen,
      { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'weighing' } },
      thinkingClose,
      textOpen,
      { type: 'message-end', stopReason: 'end', usage: {} },
    ];

    expect(await merged(events)).toEqual([
      thinkingOpen,
      { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'weighing' } },
      thinkingClose,
      textOpen,
      textClose,
      { type: 'message-end', stopReason: 'end', usage: {} },
    ]);
  });

  it('releases them when the stream ends while the text block is still open', async () => {
    expect(await merged([thinkingOpen, thinkingClose, textOpen])).toEqual([
      thinkingOpen,
      thinkingClose,
      textOpen,
      textClose,
    ]);
  });
});
