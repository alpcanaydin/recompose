import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, grantsNothing, neverFetches } from './gateway-app.testkit';

const ANTHROPIC_MODEL_PATHS = ['/v1/messages', '/messages'];
const OPENAI_MODEL_PATHS = ['/v1/chat/completions', '/chat/completions'];
const RESPONSES_MODEL_PATHS = ['/v1/responses', '/responses'];
const MODEL_PATHS = [...ANTHROPIC_MODEL_PATHS, ...OPENAI_MODEL_PATHS, ...RESPONSES_MODEL_PATHS];
const SERVED_PATHS = ['/health', '/v1/models', ...MODEL_PATHS];

async function askCodex(path: string, init?: RequestInit): Promise<Response> {
  const codex = createGatewayApp(aGatewayHolding(), grantsNothing, neverFetches);

  return codex.request(`http://127.0.0.1:8397${path}`, init);
}

async function sendModelRequest(path: string, body?: string): Promise<Response> {
  return askCodex(path, {
    method: 'POST',
    body: body ?? JSON.stringify({ model: 'ghost', messages: [] }),
  });
}

const unservedPathArb = fc
  .array(fc.stringMatching(/^[a-z0-9]{1,8}$/), { minLength: 1, maxLength: 3 })
  .map((segments) => `/${segments.join('/')}`)
  .filter((path) => !SERVED_PATHS.includes(path));

describe('the health path of a running gateway', () => {
  test('a health check answers with a success', async () => {
    const answer = await askCodex('/health');

    expect(answer.status).toBe(200);
  });

  test('the health answer carries the gateway name', async () => {
    const answer = await askCodex('/health');

    expect(await answer.json()).toEqual({ gateway: 'Codex' });
  });

  test('the health answer is JSON, so a machine check can read it', async () => {
    const answer = await askCodex('/health');

    expect(answer.headers.get('content-type')).toContain('application/json');
  });
});

describe('the address a person copies', () => {
  test('a gateway serves at the root of its address, under no name-shaped segment', async () => {
    const underItsOwnName = await askCodex('/codex/health');

    expect(underItsOwnName.status).toBe(404);
  });
});

describe('a model request naming a model nobody defined', () => {
  test.each(MODEL_PATHS)('%s refuses with a status no client retries', async (path) => {
    const refusal = await sendModelRequest(path);

    expect(refusal.status).toBe(404);
  });

  test.each(MODEL_PATHS)(
    '%s refuses in JSON, never in a body an SDK cannot parse',
    async (path) => {
      const refusal = await sendModelRequest(path);

      expect(refusal.headers.get('content-type')).toContain('application/json');
    },
  );

  test.each(MODEL_PATHS)('%s reads a request naming no model as unknown', async (path) => {
    const refusal = await sendModelRequest(path, JSON.stringify({ messages: [] }));

    expect(refusal.status).toBe(404);
  });

  test.each(MODEL_PATHS)('%s reads a request carrying no JSON body as unknown', async (path) => {
    const refusal = await askCodex(path, { method: 'POST' });

    expect(refusal.status).toBe(404);
  });
});

describe('the envelope an unknown model refuses in', () => {
  test.each(ANTHROPIC_MODEL_PATHS)('%s answers the Anthropic envelope', async (path) => {
    const refusal = await sendModelRequest(path);

    expect(await refusal.json()).toEqual({
      type: 'error',
      error: { type: 'not_found_error', message: 'No model named "ghost" is defined.' },
    });
  });

  test.each(OPENAI_MODEL_PATHS)('%s answers the OpenAI envelope', async (path) => {
    const refusal = await sendModelRequest(path);

    expect(await refusal.json()).toEqual({
      error: {
        message: 'No model named "ghost" is defined.',
        type: 'invalid_request_error',
        param: null,
        code: 'model_not_found',
      },
    });
  });

  test.each(RESPONSES_MODEL_PATHS)('%s answers the Responses envelope', async (path) => {
    const refusal = await sendModelRequest(
      path,
      JSON.stringify({ model: 'ghost', input: [{ type: 'message', role: 'user', content: 'hi' }] }),
    );

    expect(await refusal.json()).toEqual({
      error: {
        message: 'No model named "ghost" is defined.',
        type: 'invalid_request_error',
        param: null,
        code: 'model_not_found',
      },
    });
  });

  test('a request naming no model reads the empty name back', async () => {
    const refusal = await sendModelRequest('/v1/messages', JSON.stringify({ messages: [] }));

    expect(await refusal.json()).toEqual({
      type: 'error',
      error: { type: 'not_found_error', message: 'No model named "" is defined.' },
    });
  });
});

describe('a path the gateway does not serve', () => {
  test.prop([unservedPathArb])(
    'any unserved path refuses in the Anthropic envelope',
    async (path) => {
      const refusal = await askCodex(path);

      expect(refusal.status).toBe(404);
      expect(await refusal.json()).toMatchObject({
        type: 'error',
        error: { type: 'not_found_error' },
      });
    },
  );

  test('the refusal names the path nobody serves', async () => {
    const refusal = await askCodex('/v2/messages');

    expect(await refusal.json()).toEqual({
      type: 'error',
      error: {
        type: 'not_found_error',
        message: 'The gateway "Codex" serves no path "/v2/messages".',
      },
    });
  });
});
