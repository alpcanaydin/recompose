import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import { createGatewayApp } from './gateway-app';
import {
  aGatewayHolding,
  aVirtualModel,
  bodySentIn,
  fetchAnsweringWith,
  headersSentIn,
} from './gateway-app.testkit';

const model = aVirtualModel({
  target: { standing: 'bound', providerModel: 'gemini-3.6-flash' },
});

function interactionsGrant(): SpendGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://generativelanguage.googleapis.com',
    spend: {
      custody: 'credentialed',
      provider: 'gemini-interactions',
      credential: 'google-key',
      accountId: 'acc-interactions',
    },
  };
}

function appFor(fetchLike: typeof fetch) {
  return createGatewayApp(
    aGatewayHolding(model),
    async () => Promise.resolve(interactionsGrant()),
    fetchLike,
  );
}

function interactionAnswer(): Response {
  return Response.json({
    id: 'interaction_1',
    model: 'gemini-3.6-flash',
    status: 'completed',
    steps: [{ type: 'model_output', content: [{ type: 'text', text: 'hello back' }] }],
    usage: { total_input_tokens: 2, total_output_tokens: 3 },
  });
}

describe('native Gemini Interactions serving', () => {
  it('should reach the native endpoint with the provider model and Google key', async () => {
    const upstream = fetchAnsweringWith(interactionAnswer);
    const answer = await appFor(upstream.fetchLike).request(
      'http://127.0.0.1:8397/v1/interactions',
      {
        method: 'POST',
        body: JSON.stringify({ model: 'fast', input: 'hello' }),
      },
    );

    expect(upstream.sent[0]?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
    );
    expect(headersSentIn(upstream.sent).get('x-goog-api-key')).toBe('google-key');
    expect(bodySentIn(upstream.sent)).toEqual({ model: 'gemini-3.6-flash', input: 'hello' });
    await expect(answer.json()).resolves.toMatchObject({
      id: 'interaction_1',
      steps: [{ type: 'model_output' }],
    });
  });
});

describe('Anthropic requests crossing through Gemini Interactions', () => {
  it('should translate the request and the completed answer', async () => {
    const upstream = fetchAnsweringWith(interactionAnswer);
    const answer = await appFor(upstream.fetchLike).request('http://127.0.0.1:8397/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        max_tokens: 64,
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    expect(bodySentIn(upstream.sent)).toMatchObject({
      model: 'gemini-3.6-flash',
      input: [{ type: 'user_input', content: [{ type: 'text', text: 'hello' }] }],
      generation_config: { max_output_tokens: 64 },
    });
    await expect(answer.json()).resolves.toMatchObject({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'hello back' }],
      usage: { input_tokens: 2, output_tokens: 3 },
    });
  });

  it('should translate the native stream lifecycle into Anthropic events', async () => {
    const upstream = fetchAnsweringWith(interactionStream);
    const answer = await appFor(upstream.fetchLike).request('http://127.0.0.1:8397/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        max_tokens: 64,
        stream: true,
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });
    const text = await answer.text();

    expect(answer.headers.get('content-type')).toContain('text/event-stream');
    expect(text).toContain('event: message_start');
    expect(text).toContain('"text":"hello back"');
    expect(text).toContain('event: message_stop');
  });
});

function interactionStream(): Response {
  const events = [
    {
      event_type: 'interaction.created',
      interaction: { id: 'interaction_1', model: 'gemini-3.6-flash' },
    },
    { event_type: 'step.start', index: 0, step: { type: 'model_output', content: [] } },
    { event_type: 'step.delta', index: 0, delta: { type: 'text', text: 'hello back' } },
    { event_type: 'step.stop', index: 0 },
    {
      event_type: 'interaction.completed',
      interaction: {
        id: 'interaction_1',
        status: 'completed',
        usage: { total_input_tokens: 2, total_output_tokens: 3 },
      },
    },
  ];

  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}
