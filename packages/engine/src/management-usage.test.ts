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

describe('a usage record names the account and the calls it traces', () => {
  afterEach(() => {
    providerObservability().clear();
  });

  it('reports the account, the caller trace and the upstream trace it observed', async () => {
    await recordTracedUsage();
    const app = createGatewayApp(aGatewayHolding(), grantsNothing, neverFetches);

    const answer = await app.request('http://127.0.0.1:8397/v0/management/usage-queue');
    const records: unknown = await answer.json();

    expect(records).toMatchObject([{ account_id: 'acct-1', model: 'traced' }]);
    expect(JSON.stringify(records)).toMatch(/"request_id_hash":"sha256:[\da-f]{64}"/u);
    expect(JSON.stringify(records)).toMatch(/"upstream_request_id_hash":"sha256:[\da-f]{64}"/u);
  });

  it('omits the account and both traces when the call carried none', async () => {
    await recordUsage('bare');
    const app = createGatewayApp(aGatewayHolding(), grantsNothing, neverFetches);

    const answer = await app.request('http://127.0.0.1:8397/v0/management/usage-queue');
    const records: unknown = await answer.json();
    const first: unknown = Array.isArray(records) ? records[0] : undefined;

    expect(first).not.toHaveProperty('account_id');
    expect(first).not.toHaveProperty('request_id_hash');
    expect(first).not.toHaveProperty('upstream_request_id_hash');
  });
});

// Helpers

async function recordTracedUsage(): Promise<void> {
  const request: ProviderRequestLog = {
    provider: 'openai',
    model: 'traced',
    accountId: 'acct-1',
    dialect: 'responses',
    method: 'POST',
    requestId: 'client-request-1',
  };
  const response = Response.json(
    { usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } },
    { headers: { 'x-upstream-request-id': 'upstream-request-1' } },
  );

  await providerObservability().start(request).observe(response).text();
}

async function recordUsage(model: string): Promise<void> {
  const request: ProviderRequestLog = {
    provider: 'openai',
    model,
    dialect: 'responses',
    method: 'POST',
  };
  const response = Response.json({
    usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
  });

  await providerObservability().start(request).observe(response).text();
}
