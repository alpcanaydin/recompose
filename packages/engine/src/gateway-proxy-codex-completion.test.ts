import { describe, expect, it } from 'vitest';

import { codexSse, codexSubscriptionApp } from './gateway-proxy-codex-subscription.testkit';
import { chatRequest } from './gateway-proxy-subscription.testkit';
import { jsonEventsFrom } from './stream-wire';

describe('hydrating non-stream Codex completions', () => {
  it('should fill missing native Responses item ids from output_item.done', async () => {
    const { app } = codexSubscriptionApp(() =>
      codexSse([
        {
          type: 'response.output_item.done',
          output_index: 0,
          item: {
            id: 'fc_123',
            type: 'function_call',
            call_id: 'call_123',
            name: 'weather',
            arguments: '{}',
          },
        },
        {
          type: 'response.completed',
          response: {
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
        },
      ]),
    );

    const answer = await responsesRequest(app, false);

    await expect(answer.json()).resolves.toMatchObject({
      output: [{ id: 'fc_123', name: 'weather-terminal' }],
    });
  });

  it('should use output_item.done when terminal output is empty', async () => {
    const { app } = codexSubscriptionApp(() => codexSse(emptyOutputEvents()));

    const answer = await chatRequest(app);

    await expect(answer.json()).resolves.toMatchObject({
      choices: [{ message: { content: 'ok' } }],
    });
  });
});

describe('hydrating streaming Codex completions', () => {
  it('should hydrate response.completed before native Responses delivery', async () => {
    const { app } = codexSubscriptionApp(() => codexSse(emptyOutputEvents()));

    const answer = await responsesRequest(app, true);

    if (answer.body === null) throw new Error('Codex stream body is missing');

    const events = [];

    for await (const event of jsonEventsFrom(answer.body)) events.push(event);

    expect(events.at(-1)).toHaveProperty('response.output.0.content.0.text', 'ok');
  });

  it('should end a missing-terminal stream with an explicit error event', async () => {
    const { app } = codexSubscriptionApp(() =>
      codexSse([
        { type: 'response.created', response: { id: 'resp_1', status: 'in_progress', output: [] } },
      ]),
    );

    const answer = await responsesRequest(app, true);

    if (answer.body === null) throw new Error('Codex stream body is missing');

    const events = [];

    for await (const event of jsonEventsFrom(answer.body)) events.push(event);

    expect(events.at(-1)).toEqual({
      type: 'error',
      code: 'upstream_stream_incomplete',
      message:
        'stream error: stream disconnected before completion: stream closed before response.completed',
    });
  });
});

// Helpers

function emptyOutputEvents(): unknown[] {
  return [
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
  ];
}

async function responsesRequest(
  app: ReturnType<typeof codexSubscriptionApp>['app'],
  stream: boolean,
): Promise<Response> {
  return app.request('http://127.0.0.1:8397/v1/responses', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      input: [{ type: 'message', role: 'user', content: 'hello' }],
      ...(stream ? { stream: true } : {}),
    }),
  });
}
