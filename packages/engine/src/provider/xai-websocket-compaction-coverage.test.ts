import { describe, expect, test } from 'vitest';

import type { Crossing, JsonObject } from '../gateway-wire';
import type { XAICompactGrant } from './xai-websocket-compaction';

import { XAIWebSocketCompaction } from './xai-websocket-compaction';

function encrypted(seed = 5): string {
  return Buffer.from(
    Array.from({ length: 256 }, (_value, index) => (index * 41 + seed * 67 + 17) % 251),
  )
    .toString('base64')
    .replace(/=+$/u, '');
}

function grant(): XAICompactGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://api.x.ai/v1/',
    spend: { custody: 'credentialed', provider: 'xai', credential: 'xai-key' },
  };
}

function crossing(): Crossing {
  return {
    dialect: 'responses',
    raw: {},
    gatewayName: 'gateway',
    virtualModel: 'grok',
    providerModel: 'grok-4',
  };
}

function answering(status: number, payload: unknown): typeof fetch {
  return async () => {
    await Promise.resolve();

    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function refusing(): typeof fetch {
  return async () => {
    await Promise.resolve();

    return new Response('not json', { status: 500 });
  };
}

function withTurn(compaction: XAIWebSocketCompaction, request: JsonObject): void {
  compaction.observe(
    { request, reset: true },
    { type: 'response.completed', response: { output: [{ type: 'message', content: 'a' }] } },
  );
}

describe('an xAI request is read for a compaction trigger', () => {
  test('an input carrying a compaction trigger is a trigger', () => {
    const compaction = new XAIWebSocketCompaction(refusing());

    expect(compaction.isTrigger({ input: [{ type: 'compaction_trigger' }] })).toBe(true);
  });

  test('an input of ordinary items is not a trigger', () => {
    const compaction = new XAIWebSocketCompaction(refusing());

    expect(compaction.isTrigger({ input: [{ type: 'message' }] })).toBe(false);
  });

  test('a body without an input list is not a trigger', () => {
    const compaction = new XAIWebSocketCompaction(refusing());

    expect(compaction.isTrigger({ input: 'compaction_trigger' })).toBe(false);
  });
});

describe('an xAI turn decides whether the transcript restarts', () => {
  test('a turn with no earlier response restarts the transcript', () => {
    const compaction = new XAIWebSocketCompaction(refusing());

    expect(compaction.prepare({ input: [] }).reset).toBe(true);
  });

  test('a turn continuing an earlier response keeps the transcript', () => {
    const compaction = new XAIWebSocketCompaction(refusing());

    expect(compaction.prepare({ previous_response_id: 'resp_1', input: [] }).reset).toBe(false);
  });

  test('a blank earlier response identifier restarts the transcript', () => {
    const compaction = new XAIWebSocketCompaction(refusing());

    expect(compaction.prepare({ previous_response_id: '  ', input: [] }).reset).toBe(true);
  });

  test('an appended turn keeps the transcript', () => {
    const compaction = new XAIWebSocketCompaction(refusing());
    const prepared = compaction.prepare({ type: 'response.append', input: [] });

    expect(prepared.reset).toBe(false);
  });
});

describe('an xAI stream event is folded into the transcript', () => {
  test('an event outside a turn is ignored', () => {
    const compaction = new XAIWebSocketCompaction(refusing());

    expect(compaction.observe(undefined, { type: 'response.completed' })).toBeUndefined();
  });

  test('a completed response is recorded without an answer of its own', () => {
    const compaction = new XAIWebSocketCompaction(refusing());
    const turn = { request: { input: [] }, reset: true };

    expect(compaction.observe(turn, { type: 'response.completed' })).toBeUndefined();
  });

  test('an event of another kind is ignored', () => {
    const compaction = new XAIWebSocketCompaction(refusing());
    const turn = { request: { input: [] }, reset: true };

    expect(compaction.observe(turn, { type: 'response.output_text.delta' })).toBeUndefined();
  });

  test('a created response on a generating turn is ignored', () => {
    const compaction = new XAIWebSocketCompaction(refusing());
    const turn = { request: { input: [], generate: true }, reset: true };

    expect(compaction.observe(turn, { type: 'response.created' })).toBeUndefined();
  });

  test('a warmup turn is completed on the caller behalf', () => {
    const compaction = new XAIWebSocketCompaction(refusing());
    const turn = { request: { input: [], generate: false }, reset: true };
    const completed = compaction.observe(turn, { type: 'response.created', response: { id: 'r' } });

    expect(completed).toEqual({
      type: 'response.completed',
      response: {
        id: 'r',
        status: 'completed',
        output: [],
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      },
    });
  });

  test('a warmup turn keeps the output and usage the provider stated', () => {
    const compaction = new XAIWebSocketCompaction(refusing());
    const turn = { request: { input: [], generate: false }, reset: true };
    const response = { output: [{ type: 'message' }], usage: { input_tokens: 7 } };
    const completed = compaction.observe(turn, { type: 'response.created', response });

    expect(completed).toHaveProperty('response.usage', { input_tokens: 7 });
  });

  test('a warmup turn without a response object completes empty', () => {
    const compaction = new XAIWebSocketCompaction(refusing());
    const turn = { request: { input: [], generate: false }, reset: true };
    const completed = compaction.observe(turn, { type: 'response.created' });

    expect(completed).toHaveProperty('response.output', []);
  });
});

describe('an xAI compaction call reports what the provider answered', () => {
  test('an empty transcript is refused before any call is made', async () => {
    const compaction = new XAIWebSocketCompaction(refusing());
    const answer = await compaction.compact(grant(), crossing(), {}, {});

    expect(answer).toEqual({
      type: 'error',
      status: 400,
      error: { message: 'xAI WebSocket compaction context is empty' },
    });
  });

  test('a compacted transcript is reported as done', async () => {
    const item = { type: 'compaction', encrypted_content: encrypted() };
    const compaction = new XAIWebSocketCompaction(
      answering(200, { id: 'resp_compact', output: [item] }),
    );

    withTurn(compaction, { input: [{ type: 'message', role: 'user', content: 'hi' }] });

    const answer = await compaction.compact(grant(), crossing(), {}, {});

    expect(answer).toHaveProperty('type', 'response.compaction.done');
    expect(answer).toHaveProperty('model', 'grok-4');
  });

  test('a provider refusal is reported under its own status', async () => {
    const compaction = new XAIWebSocketCompaction(
      answering(429, { error: { message: 'slow down' } }),
    );

    withTurn(compaction, { input: [{ type: 'message', role: 'user', content: 'hi' }] });

    const answer = await compaction.compact(grant(), crossing(), {}, {});

    expect(answer).toEqual({ type: 'error', status: 429, error: { message: 'slow down' } });
  });

  test('a refusal the gateway cannot read reports a stand-in message', async () => {
    const compaction = new XAIWebSocketCompaction(refusing());

    withTurn(compaction, { input: [{ type: 'message', role: 'user', content: 'hi' }] });

    const answer = await compaction.compact(grant(), crossing(), {}, {});

    expect(answer).toEqual({
      type: 'error',
      status: 500,
      error: { message: 'xAI compaction failed' },
    });
  });

  test('an answer without a compaction item is refused as invalid', async () => {
    const compaction = new XAIWebSocketCompaction(answering(200, { id: 'resp_compact' }));

    withTurn(compaction, { input: [{ type: 'message', role: 'user', content: 'hi' }] });

    const answer = await compaction.compact(grant(), crossing(), {}, {});

    expect(answer).toEqual({
      type: 'error',
      status: 502,
      error: { message: 'invalid xAI compaction response' },
    });
  });
});
