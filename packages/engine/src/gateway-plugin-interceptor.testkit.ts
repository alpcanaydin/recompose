import type { PluginClient } from './plugin-abi';

import { isJsonObject } from './gateway-wire';
import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';

export type InterceptorAnswer = (
  request: Record<string, unknown>,
  method: string,
) => Record<string, unknown>;

export async function requestInterceptorHost(answer: InterceptorAnswer): Promise<PluginHost> {
  const client: PluginClient = {
    call: async (method, data) => {
      await Promise.resolve();

      if (method === pluginMethods.register) return registrationAnswer();
      if (method === pluginMethods.requestInterceptBefore) return encoded({ ok: true, result: {} });

      return encoded({ ok: true, result: answer(requestObject(data), method) });
    },
    shutdown: () => undefined,
  };
  const host = new PluginHost(() => client);

  await host.load('after-auth', '/after-auth');

  return host;
}

function requestObject(data: Uint8Array): Record<string, unknown> {
  const value: unknown = JSON.parse(new TextDecoder().decode(data));

  if (!isJsonObject(value)) throw new Error('interceptor request is invalid');

  return value;
}

function registrationAnswer(): Uint8Array {
  return encoded({
    ok: true,
    result: {
      schema_version: 2,
      metadata: { name: 'after auth' },
      capabilities: { request_interceptor: true },
    },
  });
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
