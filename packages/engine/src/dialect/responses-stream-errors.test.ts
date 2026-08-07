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
