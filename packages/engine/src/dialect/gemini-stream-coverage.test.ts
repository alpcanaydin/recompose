import { describe, expect, test } from 'vitest';

import type { GeminiPart, GeminiResponse } from './gemini-wire';
import type { HubStreamEvent } from './hub';

import { decodeStream } from './gemini-stream';

const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function chunk(parts: GeminiPart[], finishReason?: string): GeminiResponse {
  return {
    candidates: [
      {
        content: { role: 'model', parts },
        ...(finishReason === undefined ? {} : { finishReason }),
      },
    ],
  };
}

async function* streaming(responses: GeminiResponse[]): AsyncIterable<GeminiResponse> {
  for (const response of responses) {
    await Promise.resolve();
    yield response;
  }
}

async function decoded(
  responses: GeminiResponse[],
  claudeProvenance = false,
  preserveTextSignatures = false,
): Promise<HubStreamEvent[]> {
  const events: HubStreamEvent[] = [];

  for await (const event of decodeStream(
    streaming(responses),
    claudeProvenance,
    preserveTextSignatures,
  )) {
    events.push(event);
  }

  return events;
}

function openings(events: HubStreamEvent[]): unknown[] {
  return events.filter((event) => event.type === 'block-open').map((event) => event.opening);
}

describe('a Gemini part the hub cannot open is skipped', () => {
  test('a part with neither text nor a call opens nothing', async () => {
    const events = await decoded([chunk([{}]), chunk([], 'STOP')]);

    expect(openings(events)).toEqual([]);
  });

  test('a thought opens as thinking rather than text', async () => {
    const events = await decoded([chunk([{ text: 'weighing', thought: true }]), chunk([], 'STOP')]);

    expect(openings(events)).toEqual([{ kind: 'thinking' }]);
  });

  test('a plain text opens as text', async () => {
    const events = await decoded([chunk([{ text: 'hello' }]), chunk([], 'STOP')]);

    expect(openings(events)).toEqual([{ kind: 'text' }]);
  });
});

describe('a Gemini call part streams its arguments as partial JSON', () => {
  test('a call with arguments streams them', async () => {
    const part: GeminiPart = { functionCall: { id: 'call-1', name: 'Bash', args: { c: 'true' } } };
    const events = await decoded([chunk([part]), chunk([], 'STOP')]);
    const deltas = events.filter((event) => event.type === 'block-delta');

    expect(deltas[0]).toHaveProperty('delta.partialJson', '{"c":"true"}');
  });

  test('a call without arguments streams an empty object', async () => {
    const part: GeminiPart = { functionCall: { id: 'call-1', name: 'Bash' } };
    const events = await decoded([chunk([part]), chunk([], 'STOP')]);
    const deltas = events.filter((event) => event.type === 'block-delta');

    expect(deltas[0]).toHaveProperty('delta.partialJson', '{}');
  });

  test('Claude provenance restates the call identifier', async () => {
    const part: GeminiPart = { functionCall: { id: 'call-1', name: 'Bash', args: { c: 'true' } } };
    const events = await decoded([chunk([part]), chunk([], 'STOP')], true);

    expect(openings(events)[0]).not.toHaveProperty('id', 'call-1');
  });

  test('a call the provenance cannot name keeps the identifier it had', async () => {
    const part: GeminiPart = { functionCall: { id: 'call-1', name: '', args: {} } };
    const events = await decoded([chunk([part]), chunk([], 'STOP')], true);

    expect(openings(events)[0]).toHaveProperty('id', 'call-1');
  });

  test('without provenance the call keeps its own identifier', async () => {
    const part: GeminiPart = { functionCall: { id: 'call-1', name: 'Bash', args: {} } };
    const events = await decoded([chunk([part]), chunk([], 'STOP')]);

    expect(openings(events)[0]).toHaveProperty('id', 'call-1');
  });
});

describe('a Gemini media part is streamed as media rather than a block', () => {
  test('inline image data is streamed as media', async () => {
    const part: GeminiPart = { inlineData: { mimeType: 'image/png', data: PIXEL } };
    const events = await decoded([chunk([part]), chunk([], 'STOP')]);

    expect(events.some((event) => event.type === 'media')).toBe(true);
  });
});

describe('a Gemini stream ends once, however it was cut short', () => {
  test('a stream that never finishes is ended by the decoder', async () => {
    const events = await decoded([chunk([{ text: 'hello' }])]);

    expect(events.at(-1)).toEqual({ type: 'message-end', stopReason: 'end', usage: {} });
  });

  test('a stream that already ended ignores what follows', async () => {
    const events = await decoded([chunk([{ text: 'hello' }], 'STOP'), chunk([{ text: 'late' }])]);
    const ends = events.filter((event) => event.type === 'message-end');

    expect(ends).toHaveLength(1);
  });

  test('an empty stream yields nothing at all', async () => {
    expect(await decoded([])).toEqual([]);
  });
});

describe('a signed Gemini text keeps its signature only when asked', () => {
  test('a signature is dropped from the opening by default', async () => {
    const part: GeminiPart = { text: 'hello', thoughtSignature: 'sig' };
    const events = await decoded([chunk([part]), chunk([], 'STOP')]);

    expect(openings(events)).toEqual([{ kind: 'text' }]);
  });

  test('a bypass signature is never preserved', async () => {
    const part: GeminiPart = {
      text: 'hello',
      thoughtSignature: 'skip_thought_signature_validator',
    };
    const events = await decoded([chunk([part]), chunk([], 'STOP')], false, true);

    expect(openings(events)).toEqual([{ kind: 'text' }]);
  });
});
