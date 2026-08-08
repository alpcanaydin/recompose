import { describe, expect, test } from 'vitest';

import type { HubStreamEvent } from './hub';

import { decodeGeminiClaudeCarrier } from '../provider/gemini-claude-carrier';
import { geminiClaudeCarrierStream } from './gemini-claude-carrier-stream';

const signature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';

async function collected(events: readonly HubStreamEvent[]): Promise<HubStreamEvent[]> {
  async function* source(): AsyncIterable<HubStreamEvent> {
    await Promise.resolve();

    yield* events;
  }

  const seen: HubStreamEvent[] = [];

  for await (const event of geminiClaudeCarrierStream(source())) seen.push(event);

  return seen;
}

function carrierOf(event: HubStreamEvent | undefined) {
  return event?.type === 'block-open' ? decodeGeminiClaudeCarrier(event.opening.signature) : null;
}

describe('carrying a detached Gemini signature that opens the answer', () => {
  test('a signature arriving before any content points at what follows', async () => {
    const seen = await collected([
      { type: 'block-open', index: 0, opening: { kind: 'text', signature } },
      { type: 'block-close', index: 0 },
    ]);

    expect(carrierOf(seen[0])).toEqual({ signature, direction: 'next', target: 'text' });
  });

  test('a signature arriving after a tool call points back at that call', async () => {
    const seen = await collected([
      { type: 'block-open', index: 0, opening: { kind: 'tool', id: 'toolu_1', name: 'Read' } },
      { type: 'block-close', index: 0 },
      { type: 'block-open', index: 1, opening: { kind: 'text', signature } },
      { type: 'block-close', index: 1 },
    ]);

    expect(carrierOf(seen[2])).toEqual({ signature, direction: 'previous', target: 'function' });
  });
});

describe('holding events that arrive while a block is still open', () => {
  test('a message end reaching an open block is withheld with it', async () => {
    const seen = await collected([
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ]);

    expect(seen).toEqual([]);
  });

  test('an unsigned block passes through once it closes', async () => {
    const seen = await collected([
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'answer' } },
      { type: 'block-close', index: 0 },
    ]);

    expect(seen.map((event) => event.type)).toEqual(['block-open', 'block-delta', 'block-close']);
  });
});
