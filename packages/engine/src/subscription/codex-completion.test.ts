import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { jsonEventsFrom } from '../stream-wire';
import { hydrateCodexCompletionStream, hydrateCodexResponse } from './codex-completion';

const unusableIndexes: [string, number][] = [
  ['a fractional index', 1.5],
  ['a negative index', -1],
];

describe('Codex completed response hydration', () => {
  it('should fill a missing terminal item id without replacing terminal fields', () => {
    const indexed = new Map([
      [
        0,
        {
          id: 'fc_123',
          type: 'function_call',
          call_id: 'call_123',
          name: 'weather',
          arguments: '{}',
        },
      ],
    ]);
    const response = hydrateCodexResponse(
      {
        id: 'resp_1',
        status: 'completed',
        output: [
          {
            id: null,
            type: 'function_call',
            call_id: 'call_123',
            name: 'weather-terminal',
            arguments: '{}',
          },
        ],
      },
      indexed,
    );

    expect(response).toHaveProperty('output.0.id', 'fc_123');
    expect(response).toHaveProperty('output.0.name', 'weather-terminal');
  });

  it('should use ordered output_item.done items when terminal output is empty', () => {
    const indexed = new Map([
      [1, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'two' }] }],
      [0, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'one' }] }],
    ]);

    const response = hydrateCodexResponse(
      { id: 'resp_1', status: 'completed', output: [] },
      indexed,
    );

    expect(response).toHaveProperty('output.0.content.0.text', 'one');
    expect(response).toHaveProperty('output.1.content.0.text', 'two');
  });
});

describe('Codex completion stream hydration', () => {
  it('should hydrate response.completed before downstream reads it', async () => {
    const answer = hydrateCodexCompletionStream(
      sse([
        {
          type: 'response.output_item.done',
          output_index: 0,
          item: {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'ok' }],
          },
        },
        { type: 'response.completed', response: { id: 'resp_1', status: 'completed', output: [] } },
      ]),
    );
    const events = [];

    if (answer.body === null) throw new Error('hydrated stream body is missing');

    for await (const event of jsonEventsFrom(answer.body)) events.push(event);

    expect(events.at(-1)).toHaveProperty('response.output.0.content.0.text', 'ok');
  });
});

describe('Codex terminal hydration ignores an unusable output index', () => {
  it.each(unusableIndexes)('should drop a done item carrying %s', async (_label, index) => {
    const answer = hydrateCodexCompletionStream(
      sse([
        { type: 'response.output_item.done', output_index: index, item: { type: 'message' } },
        { type: 'response.completed', response: { id: 'resp_1', output: [] } },
      ]),
    );
    const events = await eventsOf(answer);

    expect(events.at(-1)).toHaveProperty('response.output', []);
  });

  it('should hydrate a terminal response that carries no output list', () => {
    const indexed = new Map([[0, { type: 'message', id: 'm_1' }]]);
    const response = hydrateCodexResponse({ id: 'resp_1', status: 'completed' }, indexed);

    expect(response).toHaveProperty('output.0.id', 'm_1');
  });
});

describe('Codex completion stream failures reach the caller as errors', () => {
  it('should report an incomplete stream when no terminal event arrives', async () => {
    const answer = hydrateCodexCompletionStream(
      sse([{ type: 'response.output_text.delta', delta: 'hi' }]),
    );
    const events = await eventsOf(answer);

    expect(events.at(-1)).toHaveProperty('code', 'upstream_stream_incomplete');
    expect(events.at(-1)).toHaveProperty('status', 408);
  });

  it('should carry the message of a failure that is an Error', async () => {
    const answer = hydrateCodexCompletionStream(failingSse(new Error('socket reset')));
    const events = await eventsOf(answer);

    expect(events.at(-1)).toHaveProperty('code', 'upstream_stream_error');
    expect(events.at(-1)).toHaveProperty('message', 'socket reset');
  });

  it('should describe a failure that is not an Error in its own words', async () => {
    const answer = hydrateCodexCompletionStream(failingSse('socket reset'));
    const events = await eventsOf(answer);

    expect(events.at(-1)).toHaveProperty('message', 'Codex upstream stream failed');
  });
});

// Helpers

function sse(events: readonly unknown[]): Response {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream', 'content-length': '1' },
  });
}

function failingSse(failure: unknown): Response {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(failure);
    },
  });

  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

async function eventsOf(response: Response): Promise<JsonObject[]> {
  if (response.body === null) throw new Error('hydrated stream body is missing');

  const events: JsonObject[] = [];

  for await (const event of jsonEventsFrom(response.body)) events.push(event);

  return events;
}
