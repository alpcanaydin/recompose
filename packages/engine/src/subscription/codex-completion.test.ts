import { describe, expect, it } from 'vitest';

import { jsonEventsFrom } from '../stream-wire';
import { hydrateCodexCompletionStream, hydrateCodexResponse } from './codex-completion';

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

// Helpers

function sse(events: readonly unknown[]): Response {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream', 'content-length': '1' },
  });
}
