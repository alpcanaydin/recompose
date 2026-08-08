import { describe, expect, test } from 'vitest';

import type { GeminiPart, GeminiResponse } from './gemini-wire';
import type { HubStreamEvent } from './hub';

import { encodeStream } from './gemini-stream-encode';

function firstPartOf(response: GeminiResponse | undefined): GeminiPart | undefined {
  return response?.candidates?.[0]?.content?.parts[0];
}

async function collected(events: readonly HubStreamEvent[]): Promise<GeminiResponse[]> {
  async function* source(): AsyncIterable<HubStreamEvent> {
    await Promise.resolve();

    yield* events;
  }

  const responses: GeminiResponse[] = [];

  for await (const response of encodeStream(source())) responses.push(response);

  return responses;
}

const ended: HubStreamEvent = { type: 'message-end', stopReason: 'end', usage: {} };

describe('encoding a signed tool call into the Gemini stream', () => {
  test('a tool call closed without arguments carries an empty argument object', async () => {
    const responses = await collected([
      { type: 'block-open', index: 0, opening: { kind: 'tool', id: 'toolu_1', name: 'Read' } },
      { type: 'block-delta', index: 0, delta: { kind: 'signature', signature: 'sig-1' } },
      { type: 'block-close', index: 0 },
      ended,
    ]);

    expect(firstPartOf(responses[0])).toEqual({
      functionCall: { id: 'toolu_1', name: 'Read', args: {} },
      thoughtSignature: 'sig-1',
    });
  });

  test('closing an index that was never opened emits nothing', async () => {
    const responses = await collected([{ type: 'block-close', index: 3 }, ended]);

    expect(responses).toHaveLength(1);
  });
});

describe('encoding assistant text into the Gemini stream', () => {
  test('a thinking delta arrives as a thought part', async () => {
    const responses = await collected([
      { type: 'block-open', index: 0, opening: { kind: 'thinking' } },
      { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'weighing it' } },
      ended,
    ]);

    expect(firstPartOf(responses[0])).toEqual({
      text: 'weighing it',
      thought: true,
    });
  });

  test('a delta for an index that was never opened still carries its text', async () => {
    const responses = await collected([
      { type: 'block-delta', index: 7, delta: { kind: 'text', text: 'orphan' } },
      ended,
    ]);

    expect(firstPartOf(responses[0])).toEqual({ text: 'orphan' });
  });
});

describe('encoding the end of a Gemini stream', () => {
  test('a refused answer finishes for safety', async () => {
    const responses = await collected([{ type: 'message-end', stopReason: 'refusal', usage: {} }]);

    expect(responses[0]?.candidates?.[0]?.finishReason).toBe('SAFETY');
  });

  test('an exhausted answer finishes on the token ceiling', async () => {
    const responses = await collected([
      { type: 'message-end', stopReason: 'max_output', usage: {} },
    ]);

    expect(responses[0]?.candidates?.[0]?.finishReason).toBe('MAX_TOKENS');
  });
});
