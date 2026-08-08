import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';
import type { PluginRequestIntercept } from './plugin-request-interceptors';

import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';
import { interceptPluginRequest } from './plugin-request-interceptors';

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

async function hostAnswering(result: unknown): Promise<PluginHost> {
  const client: PluginClient = {
    call: async (method) => {
      await Promise.resolve();

      if (method === pluginMethods.register) {
        return encoded({
          ok: true,
          result: {
            schema_version: 2,
            metadata: { name: 'interceptor' },
            capabilities: { request_interceptor: true },
          },
        });
      }

      return encoded({ ok: true, result });
    },
    shutdown: () => undefined,
  };
  const host = new PluginHost(() => client);

  await host.load('interceptor', 'interceptor', new Uint8Array(), 1);

  return host;
}

function requestFixture(): PluginRequestIntercept {
  return {
    requestId: 'request-1',
    traceId: 'trace-1',
    sourceFormat: 'chat-completions',
    toFormat: '',
    model: 'normalized',
    requestedModel: 'requested',
    stream: false,
    headers: { 'x-keep': ['yes'] },
    body: new TextEncoder().encode('start'),
    metadata: {},
  };
}

describe('a request interceptor answering with something that is not an object', () => {
  it('carries the request on unchanged', async () => {
    const host = await hostAnswering(['not', 'an', 'object']);

    const result = await interceptPluginRequest(host, 'before', requestFixture());

    expect(new TextDecoder().decode(result.body)).toBe('start');
    expect(result.headers).toEqual({ 'x-keep': ['yes'] });
    expect(result.terminate).toBe(false);
  });
});
