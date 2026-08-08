import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import type { Crossing } from './gateway-wire';
import type { PluginGatewayTarget } from './plugin-gateway';
import type { PluginRoutingHost, PluginRoutingRecord } from './plugin-routing';

import { requestInterceptorHost } from './gateway-plugin-interceptor.testkit';
import { PluginExecutorAdapter } from './plugin-executor';
import { reachPluginExecutor } from './plugin-gateway';

type ExecutorTarget = Extract<PluginGatewayTarget, { kind: 'executor' }>;
type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type Sent = { wire: unknown[] };

describe('plugin interception before a plugin executor runs', () => {
  it('should serve the interceptor answer instead of reaching the executor', async () => {
    const sent: Sent = { wire: [] };
    const plugins = await requestInterceptorHost(() => ({
      Terminate: true,
      StatusCode: 402,
      ResponseHeaders: { 'content-type': ['application/json'] },
      ResponseBody: encoded('{"error":"payment required"}'),
    }));

    const answer = await reachPluginExecutor(
      executorTarget(sent),
      crossing(),
      credentialedGrant(),
      { model: 'fast' },
      plugins,
    );

    expect(answer.status).toBe(402);
    expect(sent.wire).toEqual([]);
    await expect(answer.text()).resolves.toBe('{"error":"payment required"}');
  });

  it('should hand the executor the body an interceptor rewrote', async () => {
    const sent: Sent = { wire: [] };
    const plugins = await requestInterceptorHost(() => ({
      Body: encoded('{"model":"rewritten"}'),
    }));

    await reachPluginExecutor(
      executorTarget(sent),
      crossing(),
      credentialedGrant(),
      { model: 'fast' },
      plugins,
    );

    expect(sent.wire[0]).toMatchObject({ Payload: encoded('{"model":"rewritten"}') });
  });

  it('should hand the executor the untouched body when no interceptor changes it', async () => {
    const sent: Sent = { wire: [] };
    const plugins = await requestInterceptorHost(() => ({}));

    await reachPluginExecutor(
      executorTarget(sent),
      crossing(),
      credentialedGrant(),
      { model: 'fast' },
      plugins,
    );

    expect(sent.wire[0]).toMatchObject({ Payload: encoded('{"model":"fast"}') });
  });
});

function executorTarget(sent: Sent): ExecutorTarget {
  return {
    kind: 'executor',
    adapter: new PluginExecutorAdapter(executorHost(sent), 'plugin-executor'),
    inputDialect: 'chat-completions',
    outputDialect: 'chat-completions',
  };
}

function executorHost(sent: Sent): PluginRoutingHost {
  return {
    routingRecords: () => [executorRecord()],
    call: async (_id, _method, request, decode) => {
      sent.wire.push(request);
      await Promise.resolve();

      return decode({ Payload: encoded('{"ok":true}') });
    },
  };
}

function executorRecord(): PluginRoutingRecord {
  return {
    id: 'plugin-executor',
    priority: 1,
    metadata: {},
    executor: true,
    executorModelScope: 'both',
    executorInputFormats: ['chat-completions'],
    executorOutputFormats: ['chat-completions'],
    scheduler: false,
    modelRouter: false,
    requestInterceptor: false,
    responseInterceptor: false,
    streamChunkInterceptor: false,
  };
}

function crossing(): Crossing {
  return {
    dialect: 'chat-completions',
    raw: { model: 'fast', messages: [] },
    gatewayName: 'local',
    virtualModel: 'fast',
    providerModel: 'plugin-model',
  };
}

function credentialedGrant(): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'plugin://plugin-provider',
    spend: {
      custody: 'credentialed',
      provider: 'plugin-provider',
      credential: 'plugin-secret',
      accountId: 'acc-plugin',
    },
  };
}

function encoded(value: string): string {
  return Buffer.from(value).toString('base64');
}
