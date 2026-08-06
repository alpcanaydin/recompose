import { describe, expect, test, vi } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aCredentialedGrant, aGatewayHolding, aVirtualModel } from './gateway-app.testkit';

function askingWith(answer: () => Response): (path: string, body: unknown) => Promise<Response> {
  const app = createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    async () => Promise.resolve(aCredentialedGrant()),
    async () => Promise.resolve(answer()),
  );

  return async (path, body) =>
    app.request(`http://127.0.0.1:8397${path}`, { method: 'POST', body: JSON.stringify(body) });
}

const aChatAsk = { model: 'fast', messages: [{ role: 'user', content: 'hello' }] };

const aHubAsk = {
  model: 'fast',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
};

const aChatAnswerText = JSON.stringify({
  choices: [
    { index: 0, message: { role: 'assistant', content: 'Sunny, 21C.' }, finish_reason: 'stop' },
  ],
  usage: { prompt_tokens: 12, completion_tokens: 8 },
});

function aJsonUpstream(text: string, status = 200): () => Response {
  return () => new Response(text, { status, headers: { 'content-type': 'application/json' } });
}

describe('the answer that travels back to the caller', () => {
  test('a same-dialect answer passes through byte for byte', async () => {
    const spaced = '{"choices": []  }';
    const ask = askingWith(aJsonUpstream(spaced));

    const answer = await ask('/v1/chat/completions', aChatAsk);

    expect(answer.status).toBe(200);
    expect(await answer.text()).toBe(spaced);
  });

  test('the answer names the virtual model and the target that served it', async () => {
    const ask = askingWith(aJsonUpstream(aChatAnswerText));

    const answer = await ask('/v1/chat/completions', aChatAsk);

    expect(answer.headers.get('x-recompose-virtual-model')).toBe('fast');
    expect(answer.headers.get('x-recompose-target')).toBe('gpt-5-mini');
  });

  test('a chat answer crosses back into the Anthropic dialect', async () => {
    const ask = askingWith(aJsonUpstream(aChatAnswerText));

    const answer = await ask('/v1/messages', aHubAsk);

    expect(answer.headers.get('content-type')).toContain('application/json');
    expect(await answer.json()).toEqual({
      content: [{ type: 'text', text: 'Sunny, 21C.' }],
      stopReason: 'end',
      usage: { inputTokens: 12, outputTokens: 8 },
    });
  });

  test('an event-stream answer that carries no body passes along whole', async () => {
    const ask = askingWith(
      () => new Response(null, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );

    const answer = await ask('/v1/messages', aHubAsk);

    expect(answer.status).toBe(200);
    expect(await answer.text()).toBe('');
    expect(answer.headers.get('x-recompose-virtual-model')).toBe('fast');
  });
});

describe('an answer that does not read as the target dialect', () => {
  test('an answer the gateway cannot read forwards untouched', async () => {
    const ask = askingWith(
      () => new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } }),
    );

    const answer = await ask('/v1/messages', aHubAsk);

    expect(answer.status).toBe(200);
    expect(await answer.text()).toBe('not json');
    expect(answer.headers.get('content-type')).toBe('text/plain');
  });

  test('an answer naming no content type still crosses whole, echoing none back', async () => {
    const ask = askingWith(() => new Response(null, { status: 200 }));

    const answer = await ask('/v1/messages', aHubAsk);

    expect(answer.status).toBe(200);
    expect(await answer.text()).toBe('');
    expect(answer.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
  });

  test.each(['{"choices":[{"index":0}]}', '{"choices":[42,{"message":{}}]}'])(
    'a chat-shaped answer missing its message forwards %s untouched',
    async (upstreamText) => {
      const ask = askingWith(aJsonUpstream(upstreamText));

      const answer = await ask('/v1/messages', aHubAsk);

      expect(answer.status).toBe(200);
      expect(await answer.text()).toBe(upstreamText);
    },
  );
});

describe('a refusal the upstream provider answers', () => {
  test('forwards byte for byte with its status, under no recompose envelope', async () => {
    const upstreamRefusal = '{"error":{"message":"slow down"}}';
    const ask = askingWith(aJsonUpstream(upstreamRefusal, 429));

    const answer = await ask('/v1/chat/completions', aChatAsk);

    expect(answer.status).toBe(429);
    expect(await answer.text()).toBe(upstreamRefusal);
  });

  test('still names the virtual model and target that failed', async () => {
    const ask = askingWith(aJsonUpstream('{"error":{"message":"slow down"}}', 429));

    const answer = await ask('/v1/messages', aHubAsk);

    expect(answer.headers.get('x-recompose-virtual-model')).toBe('fast');
    expect(answer.headers.get('x-recompose-target')).toBe('gpt-5-mini');
  });

  test('an error that arrives as an event stream still forwards byte for byte', async () => {
    const upstreamText = 'data: {"error":{"message":"overloaded"}}\n\n';
    const ask = askingWith(
      () =>
        new Response(upstreamText, {
          status: 529,
          headers: { 'content-type': 'text/event-stream' },
        }),
    );

    const answer = await ask('/v1/messages', aHubAsk);

    expect(answer.status).toBe(529);
    expect(await answer.text()).toBe(upstreamText);
  });
});

describe('a request whose messages the gateway cannot read', () => {
  test('the Anthropic dialect refuses it as carrying nothing to translate', async () => {
    const ask = askingWith(aJsonUpstream(aChatAnswerText));

    const refusal = await ask('/v1/messages', {
      model: 'fast',
      messages: [{ role: 'user', content: 'a bare string is not a block list' }],
    });

    expect(refusal.status).toBe(400);
    expect(await refusal.json()).toEqual({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'The request carries no message to translate.',
      },
    });
  });

  test.each([
    ['/v1/messages', [null]],
    ['/v1/messages', [{ role: 'assistant', content: [] }, 42]],
    ['/v1/messages', [{ role: 'tool', content: [] }]],
    ['/v1/messages', [{ role: 'user', content: [{ type: 'document', text: 'a report' }] }]],
    ['/v1/messages', [{ role: 'user', content: [42] }]],
    ['/v1/messages', [{ role: 'user', content: [null] }]],
    ['/v1/messages', [{ role: 'user', content: [{ type: 'text', text: 'x' }, 42] }]],
    ['/v1/chat/completions', [null]],
    ['/v1/chat/completions', [{ role: 42 }]],
    ['/v1/chat/completions', [{ role: 'ghost', content: 'x' }]],
    ['/v1/chat/completions', [{ role: 'user', content: 'x' }, 42]],
  ])('%s refuses the message list %j as carrying nothing', async (path, messages) => {
    const ask = askingWith(aJsonUpstream(aChatAnswerText));

    const refusal = await ask(path, { model: 'fast', messages });

    expect(refusal.status).toBe(400);
  });
});

describe('what an unreadable request leaves behind', () => {
  test('an unreadable block keeps the caller words off the log', async () => {
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const ask = askingWith(aJsonUpstream(aChatAnswerText));

      const refusal = await ask('/v1/messages', {
        model: 'fast',
        messages: [{ role: 'user', content: [{ type: 'document', text: 'the-quarterly-plan' }] }],
      });

      expect(refusal.status).toBe(400);
      expect(JSON.stringify(complaints.mock.calls)).not.toContain('the-quarterly-plan');
    } finally {
      complaints.mockRestore();
    }
  });

  test('the OpenAI dialect refuses it in its own envelope', async () => {
    const ask = askingWith(aJsonUpstream(aChatAnswerText));

    const refusal = await ask('/v1/chat/completions', { model: 'fast', messages: 'nope' });

    expect(refusal.status).toBe(400);
    expect(await refusal.json()).toEqual({
      error: {
        message: 'The request carries no message to translate.',
        type: 'invalid_request_error',
        param: null,
        code: 'empty_conversation',
      },
    });
  });
});
