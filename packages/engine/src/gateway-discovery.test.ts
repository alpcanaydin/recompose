import type { EngineVirtualModel } from '@recompose/contracts';

import { describe, expect, test } from 'vitest';

import type { AskedGrants } from './gateway-app.testkit';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel, granting, neverFetches } from './gateway-app.testkit';

const fast = aVirtualModel();
const slow = aVirtualModel({ id: 'slow', displayName: 'Slow', target: { standing: 'removed' } });

function aCodexHolding(...virtualModels: readonly EngineVirtualModel[]): {
  ask: (path: string, init?: RequestInit) => Promise<Response>;
  asked: AskedGrants['asked'];
} {
  const grants = granting({ verdict: 'missing-target' });
  const app = createGatewayApp(aGatewayHolding(...virtualModels), grants.grantFor, neverFetches);

  return {
    ask: async (path, init) => app.request(`http://127.0.0.1:8397${path}`, init),
    asked: grants.asked,
  };
}

async function countTokensUnder(model: string, path = '/v1/messages/count_tokens') {
  const codex = aCodexHolding(fast, slow);
  const answer = await codex.ask(path, { method: 'POST', body: JSON.stringify({ model }) });

  return { answer, asked: codex.asked };
}

describe('the model listing a caller discovers', () => {
  test('GET /v1/models answers one merged body both dialect families read', async () => {
    const { ask } = aCodexHolding(fast, slow);

    const answer = await ask('/v1/models');

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({
      object: 'list',
      data: [
        { id: 'fast', object: 'model', type: 'model', display_name: 'Fast' },
        { id: 'slow', object: 'model', type: 'model', display_name: 'Slow' },
      ],
      first_id: 'fast',
      has_more: false,
      last_id: 'slow',
    });
  });

  test('the listing is JSON, so a picker can read it', async () => {
    const { ask } = aCodexHolding(fast);

    const answer = await ask('/v1/models');

    expect(answer.headers.get('content-type')).toContain('application/json');
  });

  test('a single model opens and closes its own page', async () => {
    const { ask } = aCodexHolding(fast);

    const answer = await ask('/v1/models');

    expect(await answer.json()).toMatchObject({ first_id: 'fast', last_id: 'fast' });
  });

  test('a gateway holding no virtual model lists an empty page', async () => {
    const { ask } = aCodexHolding();

    const answer = await ask('/v1/models');

    expect(await answer.json()).toEqual({
      object: 'list',
      data: [],
      first_id: null,
      has_more: false,
      last_id: null,
    });
  });

  test('the listing answers from the snapshot with no grant round trip', async () => {
    const codex = aCodexHolding(fast, slow);

    await codex.ask('/v1/models');

    expect(codex.asked).toEqual([]);
  });

  test('the listing refuses a caller that carries an Origin header', async () => {
    const { ask } = aCodexHolding(fast);

    const refusal = await ask('/v1/models', { headers: { origin: 'https://web.example' } });

    expect(refusal.status).toBe(403);
  });
});

describe('the count_tokens path of a defined model', () => {
  test.each(['/v1/messages/count_tokens', '/messages/count_tokens'])(
    '%s resolves the target and reports a missing target, never a 404',
    async (path) => {
      const { answer } = await countTokensUnder('fast', path);

      expect(answer.status).toBe(502);
      expect(await answer.json()).toEqual({
        type: 'error',
        error: {
          type: 'api_error',
          message: 'The gateway "Codex" holds no target for the virtual model "fast".',
        },
      });
    },
  );

  test('a removed target draws the missing-target refusal', async () => {
    const { answer } = await countTokensUnder('slow');

    expect(answer.status).toBe(502);
  });

  test('a bound model resolves a live grant for every count', async () => {
    const { asked } = await countTokensUnder('fast');

    expect(asked).toEqual([{ slug: 'codex', virtualModel: 'fast' }]);
  });
});

describe('the count_tokens path of an unknown model', () => {
  test('keeps the 404 in the Anthropic envelope', async () => {
    const { answer } = await countTokensUnder('ghost');

    expect(answer.status).toBe(404);
    expect(await answer.json()).toEqual({
      type: 'error',
      error: { type: 'not_found_error', message: 'No model named "ghost" is defined.' },
    });
  });

  test('a request carrying no JSON body is invalid before model lookup', async () => {
    const codex = aCodexHolding(fast);

    const answer = await codex.ask('/v1/messages/count_tokens', { method: 'POST' });

    expect(answer.status).toBe(400);
  });
});
