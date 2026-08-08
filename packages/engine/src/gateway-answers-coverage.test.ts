import { describe, expect, it } from 'vitest';

import type { Crossing, JsonObject, ProxyDialect } from './gateway-wire';

import { answerFrom } from './gateway-answers';

const SSE = { 'content-type': 'text/event-stream' };

function crossingTo(dialect: ProxyDialect, raw: JsonObject = { stream: true }): Crossing {
  return {
    dialect,
    raw,
    gatewayName: 'gateway one',
    virtualModel: 'virtual-model',
    providerModel: 'provider-model',
  };
}

function sseUpstream(events: readonly JsonObject[]): Response {
  const text = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

  return new Response(text, { status: 200, headers: SSE });
}

function anthropicWire(): readonly JsonObject[] {
  return [
    {
      type: 'message_start',
      message: {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'upstream-model',
        content: [],
        stop_reason: null,
        usage: { input_tokens: 3, output_tokens: 0 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 2 } },
    { type: 'message_stop' },
  ];
}

describe('an upstream answer the gateway hands back untouched', () => {
  it('should pass a refused upstream answer along with its retry advice', async () => {
    const upstream = new Response('slow down', {
      status: 429,
      headers: { 'content-type': 'text/plain', 'retry-after': '30' },
    });
    const answer = await answerFrom(crossingTo('anthropic'), upstream, 'anthropic');

    expect(answer.status).toBe(429);
    expect(answer.headers.get('retry-after')).toBe('30');
    expect(answer.headers.get('x-recompose-virtual-model')).toBe('virtual-model');
    expect(answer.headers.get('x-recompose-target')).toBe('provider-model');
  });

  it('should pass a streamed answer with no body along', async () => {
    const upstream = new Response(null, { status: 200, headers: SSE });
    const answer = await answerFrom(crossingTo('chat-completions'), upstream, 'anthropic');

    expect(answer.status).toBe(200);
    expect(answer.body).toBeNull();
  });

  it('should pass a same-dialect streamed answer with no body along', async () => {
    const upstream = new Response(null, { status: 200, headers: SSE });
    const answer = await answerFrom(crossingTo('anthropic'), upstream, 'anthropic');

    expect(answer.body).toBeNull();
  });
});

describe('a streamed answer the caller reads in its own dialect', () => {
  it('should leave a Gemini stream exactly as the provider wrote it', async () => {
    const upstream = sseUpstream([{ candidates: [{ content: { parts: [{ text: 'Hello' }] } }] }]);
    const answer = await answerFrom(crossingTo('gemini'), upstream, 'gemini');

    await expect(answer.text()).resolves.toContain('Hello');
    expect(answer.headers.get('content-type')).toBe('text/event-stream');
  });

  it('should name the target model on an Anthropic stream of its own dialect', async () => {
    const answer = await answerFrom(
      crossingTo('anthropic'),
      sseUpstream(anthropicWire()),
      'anthropic',
    );

    await expect(answer.text()).resolves.toContain('"model":"provider-model"');
  });

  it('should name the virtual model on a Responses stream of its own dialect', async () => {
    const upstream = sseUpstream([
      { type: 'response.created', response: { id: 'resp_1', model: 'upstream-model' } },
    ]);
    const answer = await answerFrom(crossingTo('responses'), upstream, 'responses');

    await expect(answer.text()).resolves.toContain('"model":"virtual-model"');
  });

  it('should cross a stream that arrives in another dialect', async () => {
    const answer = await answerFrom(
      crossingTo('chat-completions'),
      sseUpstream(anthropicWire()),
      'anthropic',
    );

    expect(answer.headers.get('content-type')).toBe('text/event-stream');
    await expect(answer.text()).resolves.toContain('Hello');
  });
});

describe('a Responses stream collected for a caller who never asked to stream', () => {
  it('should refuse when the upstream answer carries no body at all', async () => {
    const upstream = new Response(null, { status: 200, headers: SSE });
    const answer = await answerFrom(crossingTo('responses', {}), upstream, 'responses');

    expect(answer.status).toBe(502);
    await expect(answer.text()).resolves.toContain('could not reach the target');
  });

  it('should refuse when the stream ends without a completed response', async () => {
    const upstream = sseUpstream([{ type: 'response.output_text.delta', delta: 'Hello' }]);
    const answer = await answerFrom(crossingTo('responses', {}), upstream, 'responses');

    expect(answer.status).toBe(502);
    await expect(answer.text()).resolves.toContain('could not reach the target');
  });

  it('should answer with the completed response the stream carried', async () => {
    const completed = {
      id: 'resp_1',
      object: 'response',
      model: 'upstream-model',
      status: 'completed',
      output: [
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Hello' }] },
      ],
    };
    const upstream = sseUpstream([{ type: 'response.completed', response: completed }]);
    const answer = await answerFrom(crossingTo('anthropic', {}), upstream, 'responses');

    expect(answer.status).toBe(200);
    await expect(answer.text()).resolves.toContain('Hello');
  });
});
