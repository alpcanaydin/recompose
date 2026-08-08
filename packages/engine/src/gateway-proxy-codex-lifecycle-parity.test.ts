import { describe, expect, test } from 'vitest';

import { codexSse, codexSubscriptionApp } from './gateway-proxy-codex-subscription.testkit';
import { jsonEventsFrom } from './stream-wire';

async function responsesRequest(
  app: ReturnType<typeof codexSubscriptionApp>['app'],
  stream: boolean,
): Promise<Response> {
  return Promise.resolve(
    app.request('http://127.0.0.1:8397/v1/responses', {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', input: 'hello', ...(stream ? { stream: true } : {}) }),
    }),
  );
}

function missingCompletion() {
  return codexSse([
    { type: 'response.created', response: { id: 'resp_1', status: 'in_progress' } },
  ]);
}

function interruptedResponse(): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode('data: {"type":"response.created","response":{"id":"resp_1"}}\n\n'),
      );
      controller.error(new Error('connection reset'));
    },
  });

  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

async function lastEvent(answer: Response): Promise<unknown> {
  if (answer.body === null) throw new Error('Codex response body is missing');

  const events = [];

  for await (const event of jsonEventsFrom(answer.body)) events.push(event);

  return events.at(-1);
}

describe('Codex missing completion lifecycle parity', () => {
  test('TestCodexExecutorExecuteMissingCompletionIsRequestScoped', async () => {
    const { app } = codexSubscriptionApp(missingCompletion);
    const answer = await responsesRequest(app, false);

    expect(answer.status).toBe(408);
    await expect(answer.json()).resolves.toMatchObject({
      error: { code: 'upstream_stream_incomplete', scope: 'request', status: 408 },
    });
  });

  test('TestCodexExecutorExecuteStreamMissingCompletionIsRequestScoped', async () => {
    const { app } = codexSubscriptionApp(missingCompletion);
    const answer = await responsesRequest(app, true);

    await expect(lastEvent(answer)).resolves.toMatchObject({
      type: 'error',
      code: 'upstream_stream_incomplete',
      scope: 'request',
      status: 408,
    });
  });
});

describe('Codex interrupted transport lifecycle parity', () => {
  test.each([false, true])(
    'TestCodexExecutorTransportFailureBeforeTerminalIsRequestScoped stream=%s',
    async (stream) => {
      const { app } = codexSubscriptionApp(interruptedResponse);
      const answer = await responsesRequest(app, stream);

      if (stream) {
        await expect(lastEvent(answer)).resolves.toMatchObject({
          code: 'upstream_stream_error',
          scope: 'request',
          status: 408,
        });
      } else {
        expect(answer.status).toBe(408);
        await expect(answer.json()).resolves.toMatchObject({
          error: { code: 'upstream_stream_error', scope: 'request', status: 408 },
        });
      }
    },
  );
});
