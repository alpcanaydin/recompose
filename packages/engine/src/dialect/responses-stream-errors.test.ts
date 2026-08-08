import { describe, expect, it } from 'vitest';

import type { ResponsesStreamEvent } from './responses-wire';

import { decodeStream } from './responses-stream';

describe('Responses terminal stream errors', () => {
  it('should normalize a nested context error and stop before completion', async () => {
    const events = await decoded([
      {
        type: 'error',
        error: {
          type: 'invalid_request_error',
          code: 'context_length_exceeded',
          message: 'Your input exceeds the context window',
        },
      },
      { type: 'response.completed', response: { id: 'r', status: 'completed', output: [] } },
    ]);

    expect(events).toEqual([
      {
        type: 'stream-error',
        error: { type: 'context_too_large', message: 'Your input exceeds the context window' },
      },
    ]);
  });

  it('should preserve a usage-limit response.failed type', async () => {
    const events = await decoded([
      {
        type: 'response.failed',
        response: {
          id: 'r',
          status: 'failed',
          output: [],
          error: {
            type: 'usage_limit_reached',
            message: 'usage limit reached',
            resets_in_seconds: 60,
          },
        },
      },
    ]);

    expect(events).toEqual([
      {
        type: 'stream-error',
        error: { type: 'usage_limit_reached', message: 'usage limit reached' },
      },
    ]);
  });
});

describe('Responses upstream stream lifecycle failures', () => {
  it('should report a stream that closes before a terminal response', async () => {
    const events = await decoded([
      { type: 'response.created', response: { id: 'r', status: 'in_progress', output: [] } },
    ]);

    expect(events.at(-1)).toEqual({
      type: 'stream-error',
      error: {
        type: 'upstream_stream_incomplete',
        message:
          'stream error: stream disconnected before completion: stream closed before response.completed',
      },
    });
  });

  it('should report a transport failure before terminal completion', async () => {
    const events = [];

    for await (const event of decodeStream(failingSource())) events.push(event);

    expect(events.at(-1)).toEqual({
      type: 'stream-error',
      error: { type: 'upstream_stream_error', message: 'connection reset' },
    });
  });

  it('should not read a transport failure after terminal completion', async () => {
    const events = [];

    for await (const event of decodeStream(failureAfterCompletion())) events.push(event);

    expect(events.at(-1)).toMatchObject({ type: 'message-end' });
    expect(events.some((event) => event.type === 'stream-error')).toBe(false);
  });
});

// Helpers

async function decoded(events: readonly ResponsesStreamEvent[]) {
  async function* source(): AsyncIterable<ResponsesStreamEvent> {
    await Promise.resolve();

    yield* events;
  }

  const held = [];

  for await (const event of decodeStream(source())) held.push(event);

  return held;
}

async function* failingSource(): AsyncIterable<ResponsesStreamEvent> {
  await Promise.resolve();

  yield { type: 'response.created', response: { id: 'r', status: 'in_progress', output: [] } };

  throw new Error('connection reset');
}

async function* failureAfterCompletion(): AsyncIterable<ResponsesStreamEvent> {
  await Promise.resolve();

  yield { type: 'response.completed', response: { id: 'r', status: 'completed', output: [] } };

  throw new Error('must not be read');
}
