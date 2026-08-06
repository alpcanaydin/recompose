import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, granting, neverFetches } from './gateway-app.testkit';
import {
  chatRequest,
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
  subscriptionModel,
} from './gateway-proxy-subscription.testkit';

function codexApp(answer: () => Response) {
  const grants = granting(subscriptionGrant('openai', codexCredential()));
  const provider = runtimeAnswering(answer);
  const app = createGatewayApp(
    aGatewayHolding(subscriptionModel),
    grants.grantFor,
    neverFetches,
    provider.runtime,
  );

  return { app, provider };
}

const completed = {
  type: 'response.completed',
  response: {
    id: 'resp_1',
    status: 'completed',
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'hello back' }],
      },
    ],
    usage: { input_tokens: 3, output_tokens: 2 },
  },
};

const streamEvents = [
  { type: 'response.created', response: { id: 'resp_1', status: 'in_progress', output: [] } },
  {
    type: 'response.output_item.added',
    output_index: 0,
    item: { type: 'message', role: 'assistant' },
  },
  { type: 'response.output_text.delta', output_index: 0, delta: 'hello back' },
  { type: 'response.output_item.done', output_index: 0 },
  { type: 'response.completed', response: { id: 'resp_1', status: 'completed', output: [] } },
];

function sseFor(events: readonly unknown[]): Response {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('serving a Codex subscription target', () => {
  test('a non-streaming Anthropic request consumes Codex SSE into one Messages document', async () => {
    const { app, provider } = codexApp(() => sseFor([completed]));
    const answer = await app.request('http://127.0.0.1:8397/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        max_tokens: 64,
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.request.url).toBe('https://chatgpt.com/backend-api/codex/responses');
    expect(JSON.parse(provider.sent[0]?.request.body ?? '{}')).toMatchObject({
      model: 'claude-sonnet-4-5',
      stream: true,
    });
    expect(answer.headers.get('content-type')).toContain('application/json');
    expect(await answer.json()).toMatchObject({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'hello back' }],
    });
  });

  test('a streaming Chat Completions request translates each Codex Responses event', async () => {
    const { app } = codexApp(() => sseFor(streamEvents));
    const answer = await chatRequest(app, true);
    const text = await answer.text();

    expect(answer.headers.get('content-type')).toContain('text/event-stream');
    expect(text).toContain('"content":"hello back"');
    expect(text).toContain('data: [DONE]');
  });
});
