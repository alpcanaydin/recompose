import { afterEach, describe, expect, it } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, grantsNothing, neverFetches } from './gateway-app.testkit';
import { type ProviderRequestLog, providerObservability } from './provider/provider-observability';

describe('management usage queue', () => {
  afterEach(() => {
    providerObservability().clear();
  });

  it('should pop the requested oldest records', async () => {
    await recordUsage('one');
    await recordUsage('two');
    await recordUsage('three');
    const app = createGatewayApp(aGatewayHolding(), grantsNothing, neverFetches);

    const answer = await app.request('http://127.0.0.1:8397/v0/management/usage-queue?count=2');
    const records: unknown = await answer.json();

    expect(answer.status).toBe(200);
    expect(records).toMatchObject([{ model: 'one' }, { model: 'two' }]);
    expect(
      providerObservability()
        .snapshot()
        .map(({ model }) => model),
    ).toEqual(['three']);
  });

  it('should default to one record', async () => {
    await recordUsage('one');
    await recordUsage('two');
    const app = createGatewayApp(aGatewayHolding(), grantsNothing, neverFetches);

    const answer = await app.request('http://127.0.0.1:8397/v0/management/usage-queue');
    const records: unknown = await answer.json();

    expect(records).toMatchObject([{ model: 'one' }]);
    expect(providerObservability().snapshot()).toHaveLength(1);
  });

  it('should reject an invalid count without consuming a record', async () => {
    await recordUsage('one');
    const app = createGatewayApp(aGatewayHolding(), grantsNothing, neverFetches);

    const answer = await app.request('http://127.0.0.1:8397/v0/management/usage-queue?count=0');

    expect(answer.status).toBe(400);
    expect(
      providerObservability()
        .snapshot()
        .map(({ model }) => model),
    ).toEqual(['one']);
  });
});

// Helpers

async function recordUsage(model: string): Promise<void> {
  const request: ProviderRequestLog = {
    provider: 'openai',
    model,
    dialect: 'responses',
    method: 'POST',
    url: 'https://api.openai.com/v1/responses',
    headers: new Headers(),
    body: new Uint8Array(),
  };
  const response = Response.json({
    usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
  });

  await providerObservability().start(request).observe(response).text();
}
