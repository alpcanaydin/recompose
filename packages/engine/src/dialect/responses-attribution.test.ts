import { describe, expect, it } from 'vitest';

import type { ResponsesStreamEvent } from './responses-wire';

import { respondingModelInto, responsesAnsweredBy } from './responses-attribution';

describe('Responses answer model attribution', () => {
  it('should expose the requested model on a completed answer', () => {
    expect(
      responsesAnsweredBy(
        { id: 'resp_1', model: 'provider-model', status: 'completed', output: [] },
        'virtual-model',
      ),
    ).toHaveProperty('model', 'virtual-model');
  });

  it('should expose the requested model on every response envelope', async () => {
    const source: ResponsesStreamEvent[] = [
      {
        type: 'response.created',
        response: { id: 'resp_1', model: 'provider-model', status: 'in_progress', output: [] },
      },
      {
        type: 'response.completed',
        response: { id: 'resp_1', model: 'provider-model', status: 'completed', output: [] },
      },
    ];
    const events = [];

    for await (const event of respondingModelInto(streamOf(source), 'virtual-model')) {
      events.push(event);
    }

    expect(events.map(modelOf)).toEqual(['virtual-model', 'virtual-model']);
  });
});

function modelOf(event: ResponsesStreamEvent): string | undefined {
  return 'response' in event ? event.response.model : undefined;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
