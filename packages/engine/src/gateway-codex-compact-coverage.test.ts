import type { EngineVirtualModel, SpendGrant } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import { createGatewayApp } from './gateway-app';
import {
  aGatewayHolding,
  aVirtualModel,
  fetchAnsweringWith,
  granting,
  headersSentIn,
  neverFetches,
} from './gateway-app.testkit';
import {
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
} from './gateway-proxy-subscription.testkit';

const COMPACT_URL = 'http://127.0.0.1:8397/v1/responses/compact';

type GatewayApp = ReturnType<typeof createGatewayApp>;

async function askCompact(app: GatewayApp, model: string): Promise<Response> {
  return app.request(COMPACT_URL, {
    method: 'POST',
    body: JSON.stringify({ model, input: [{ type: 'compaction_trigger' }] }),
  });
}

function appRefusing(grant: SpendGrant, model: EngineVirtualModel) {
  const provider = runtimeAnswering(() => Response.json({ id: 'resp_1' }));

  return createGatewayApp(
    aGatewayHolding(model),
    granting(grant).grantFor,
    neverFetches,
    provider.runtime,
  );
}

describe('a compaction the gateway cannot route', () => {
  it('should refuse a virtual model the gateway never holds', async () => {
    const answer = await askCompact(
      appRefusing(subscriptionGrant('openai', codexCredential()), aVirtualModel()),
      'ghost',
    );

    expect(answer.status).toBe(404);
    await expect(answer.text()).resolves.toContain('ghost');
  });

  it('should refuse a virtual model whose target was removed', async () => {
    const model = aVirtualModel({ target: { standing: 'removed' } });
    const answer = await askCompact(
      appRefusing(subscriptionGrant('openai', codexCredential()), model),
      model.id,
    );

    expect(answer.status).toBe(502);
    await expect(answer.text()).resolves.toContain('holds no target');
  });

  it('should refuse when the account lane holds no target', async () => {
    const model = aVirtualModel();
    const answer = await askCompact(appRefusing({ verdict: 'missing-target' }, model), model.id);

    expect(answer.status).toBe(502);
    await expect(answer.text()).resolves.toContain('holds no target');
  });

  it('should refuse when the account lane holds no credential', async () => {
    const model = aVirtualModel();
    const answer = await askCompact(
      appRefusing({ verdict: 'missing-credential' }, model),
      model.id,
    );

    expect(answer.status).toBe(502);
    await expect(answer.text()).resolves.toContain('credential');
  });
});

describe('a compaction that leaves the gateway for a keyed target', () => {
  it('should reach the credentialed origin without doubling its slash', async () => {
    const model = aVirtualModel({ target: { standing: 'bound', providerModel: 'gpt-5.4' } });
    const upstream = fetchAnsweringWith(() => Response.json({ id: 'resp_9', output: [] }));
    const grant: SpendGrant = {
      verdict: 'resolved',
      providerOrigin: 'https://api.openai.com/v1//',
      spend: { custody: 'credentialed', provider: 'openai', credential: 'sk-live-40d1' },
    };
    const app = createGatewayApp(
      aGatewayHolding(model),
      granting(grant).grantFor,
      upstream.fetchLike,
      runtimeAnswering(() => Response.json({})).runtime,
    );
    const answer = await askCompact(app, model.id);

    expect(upstream.sent[0]?.url).toBe('https://api.openai.com/v1/responses/compact');
    expect(headersSentIn(upstream.sent).get('Authorization')).toBe('Bearer sk-live-40d1');
    await expect(answer.json()).resolves.toEqual({ id: 'resp_9', output: [] });
  });

  it('should refuse a subscription that is not a Codex one, since it cannot be compacted', async () => {
    const model = aVirtualModel({
      target: { standing: 'bound', providerModel: 'claude-opus-4-6' },
    });
    const answer = await askCompact(
      appRefusing(subscriptionGrant('anthropic', 'sk-ant-oat01-abc'), model),
      model.id,
    );

    expect(answer.status).toBe(502);
    await expect(answer.text()).resolves.toContain('credential');
  });
});

describe('the answer a Codex compaction brings back', () => {
  it('should normalize an upstream failure into a refusal the caller can read', async () => {
    const model = aVirtualModel({ target: { standing: 'bound', providerModel: 'gpt-5.4' } });
    const provider = runtimeAnswering(() =>
      Response.json({ error: { message: 'usage limit reached' } }, { status: 429 }),
    );
    const app = createGatewayApp(
      aGatewayHolding(model),
      granting(subscriptionGrant('openai', codexCredential())).grantFor,
      neverFetches,
      provider.runtime,
    );
    const answer = await askCompact(app, model.id);

    expect(answer.status).toBe(429);
    await expect(answer.text()).resolves.toContain('usage limit reached');
  });

  it('should hand back an upstream answer that carries no JSON at all', async () => {
    const model = aVirtualModel({ target: { standing: 'bound', providerModel: 'gpt-5.4' } });
    const provider = runtimeAnswering(() => new Response('compacted', { status: 200 }));
    const app = createGatewayApp(
      aGatewayHolding(model),
      granting(subscriptionGrant('openai', codexCredential())).grantFor,
      neverFetches,
      provider.runtime,
    );
    const answer = await askCompact(app, model.id);

    expect(answer.status).toBe(200);
    await expect(answer.text()).resolves.toBe('compacted');
  });
});
