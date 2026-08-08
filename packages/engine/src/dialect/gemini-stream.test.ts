import { describe, expect, test } from 'vitest';

import type { GeminiPart, GeminiResponse } from './gemini-wire';

import { decodeStream } from './gemini-stream';

async function* source(): AsyncIterable<GeminiResponse> {
  await Promise.resolve();
  yield {
    candidates: [{ content: { role: 'model', parts: [{ text: 'hel' }] } }],
    usageMetadata: { promptTokenCount: 3 },
  };
  yield {
    candidates: [
      {
        content: { role: 'model', parts: [{ text: 'lo' }] },
        finishReason: 'MAX_TOKENS',
      },
    ],
    usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
  };
}

describe('Gemini stream decoding', () => {
  test('emits ordered hub blocks and terminal usage', async () => {
    const events = [];

    for await (const event of decodeStream(source())) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'message-begin', usage: { inputTokens: 3, totalInputTokens: 3 } },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'hel' } },
      { type: 'block-close', index: 0 },
      { type: 'block-open', index: 1, opening: { kind: 'text' } },
      { type: 'block-delta', index: 1, delta: { kind: 'text', text: 'lo' } },
      { type: 'block-close', index: 1 },
      {
        type: 'message-end',
        stopReason: 'max_output',
        usage: { inputTokens: 3, totalInputTokens: 3, outputTokens: 2 },
      },
    ]);
  });
});

describe('Gemini stream function-call signatures', () => {
  test('carries a native function-call signature on the tool opening', async () => {
    const signature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
    const events = [];

    for await (const event of decodeStream(
      oneResponse({
        functionCall: { id: 'native-call', name: 'run', args: { command: 'true' } },
        thoughtSignature: signature,
      }),
    )) {
      events.push(event);
    }

    expect(events).toContainEqual({
      type: 'block-open',
      index: 0,
      opening: { kind: 'tool', id: 'native-call', name: 'run', signature },
    });
  });

  test('drops bypass and malformed function-call signatures', async () => {
    const events = [];

    for await (const event of decodeStream(
      responsesOf(['skip_thought_signature_validator', 'not-a-provider-signature']),
    )) {
      events.push(event);
    }

    const openings = events.filter((event) => event.type === 'block-open');

    expect(openings).toEqual([
      { type: 'block-open', index: 0, opening: { kind: 'tool', id: 'call_0', name: 'run' } },
      { type: 'block-open', index: 1, opening: { kind: 'tool', id: 'call_1', name: 'run' } },
    ]);
  });
});

// Helpers

async function* oneResponse(part: GeminiPart): AsyncIterable<GeminiResponse> {
  await Promise.resolve();
  yield { candidates: [{ content: { role: 'model', parts: [part] }, finishReason: 'STOP' }] };
}

async function* responsesOf(signatures: readonly string[]): AsyncIterable<GeminiResponse> {
  await Promise.resolve();
  yield {
    candidates: [
      {
        content: {
          role: 'model',
          parts: signatures.map((thoughtSignature, index) => ({
            functionCall: { id: `call_${String(index)}`, name: 'run', args: {} },
            thoughtSignature,
          })),
        },
        finishReason: 'STOP',
      },
    ],
  };
}
