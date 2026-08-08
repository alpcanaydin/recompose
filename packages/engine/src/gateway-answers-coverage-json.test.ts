import { describe, expect, it } from 'vitest';

import type { Crossing, JsonObject, ProxyDialect } from './gateway-wire';

import { answerFrom } from './gateway-answers';

function crossingTo(dialect: ProxyDialect, raw: JsonObject = {}, extra: Partial<Crossing> = {}) {
  return {
    dialect,
    raw,
    gatewayName: 'gateway one',
    virtualModel: 'virtual-model',
    providerModel: 'provider-model',
    ...extra,
  } satisfies Crossing;
}

function anthropicAnswer(overrides: JsonObject = {}): JsonObject {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'upstream-model',
    content: [{ type: 'text', text: 'Hello' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 3, output_tokens: 2 },
    ...overrides,
  };
}

function jsonUpstream(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('an upstream answer the gateway cannot read as JSON', () => {
  it('should hand the raw text back with the gateway attribution', async () => {
    const upstream = new Response('not json at all', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
    const answer = await answerFrom(crossingTo('anthropic'), upstream, 'anthropic');

    await expect(answer.text()).resolves.toBe('not json at all');
    expect(answer.headers.get('x-recompose-target')).toBe('provider-model');
  });
});

describe('an upstream answer already written in the caller dialect', () => {
  it('should name the target model on an Anthropic answer', async () => {
    const answer = await answerFrom(
      crossingTo('anthropic'),
      jsonUpstream(anthropicAnswer()),
      'anthropic',
    );

    await expect(answer.json()).resolves.toMatchObject({ model: 'provider-model' });
  });

  it('should hand back an Anthropic-shaped answer it cannot recognize', async () => {
    const answer = await answerFrom(
      crossingTo('anthropic'),
      jsonUpstream({ id: 'msg_1', type: 'message' }),
      'anthropic',
    );

    await expect(answer.json()).resolves.toEqual({ id: 'msg_1', type: 'message' });
  });

  it('should hand back a chat answer of its own dialect untouched', async () => {
    const chat = { id: 'chatcmpl_1', model: 'upstream-model', choices: [] };
    const answer = await answerFrom(
      crossingTo('chat-completions'),
      jsonUpstream(chat),
      'chat-completions',
    );

    await expect(answer.json()).resolves.toEqual(chat);
  });
});

describe('an upstream answer the gateway crosses into the caller dialect', () => {
  it('should cross an Anthropic answer onto the chat wire', async () => {
    const answer = await answerFrom(
      crossingTo('chat-completions'),
      jsonUpstream(anthropicAnswer()),
      'anthropic',
    );

    await expect(answer.text()).resolves.toContain('Hello');
    expect(answer.status).toBe(200);
  });

  it('should echo the tools the caller declared on a crossed Responses answer', async () => {
    const tools = [{ type: 'function', name: 'lookup' }];
    const answer = await answerFrom(
      crossingTo('responses', { tools }),
      jsonUpstream(anthropicAnswer()),
      'anthropic',
    );

    await expect(answer.json()).resolves.toMatchObject({ model: 'virtual-model', tools });
  });

  it('should hand back a Gemini answer that carries no Gemini shape', async () => {
    const answer = await answerFrom(
      crossingTo('anthropic'),
      jsonUpstream({ note: 'nothing Gemini about this' }),
      'gemini',
    );

    await expect(answer.json()).resolves.toEqual({ note: 'nothing Gemini about this' });
  });

  it('should refuse an answer whose stop reason the caller dialect cannot carry', async () => {
    const answer = await answerFrom(
      crossingTo('chat-completions'),
      jsonUpstream(anthropicAnswer({ stop_reason: 'pause_turn' })),
      'anthropic',
    );

    await expect(answer.text()).resolves.toContain('pause');
  });
});
