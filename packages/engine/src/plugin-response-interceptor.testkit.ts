import type { PluginClient } from './plugin-abi';

import { isJsonObject } from './gateway-wire';
import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';

type Capabilities = {
  request?: boolean;
  response?: boolean;
  stream?: boolean;
};

type PluginAnswer = (
  method: string,
  request: Record<string, unknown>,
) => Record<string, unknown> | Promise<Record<string, unknown>>;

export function responsePlugin(capabilities: Capabilities, answer: PluginAnswer) {
  const methods: string[] = [];
  const requests: Record<string, unknown>[] = [];
  const client: PluginClient = {
    call: async (method, data) => {
      await Promise.resolve();
      methods.push(method);

      if (method === pluginMethods.register) return registrationAnswer(capabilities);

      const request = requestObject(data);

      requests.push(request);

      return encoded({ ok: true, result: await answer(method, request) });
    },
    shutdown: () => undefined,
  };

  return { client, methods, requests };
}

export async function responseHost(
  plugins: readonly [id: string, priority: number, plugin: ReturnType<typeof responsePlugin>][],
): Promise<PluginHost> {
  const clients = new Map(plugins.map(([id, _priority, plugin]) => [id, plugin.client]));
  const host = new PluginHost((path) => {
    const client = clients.get(path);

    if (client === undefined) throw new Error(`missing response interceptor ${path}`);

    return client;
  });

  await Promise.all(
    plugins.map(async ([id, priority]) => host.load(id, id, new Uint8Array(), priority)),
  );

  return host;
}

export function decodedPluginBytes(value: unknown): string {
  return typeof value === 'string' ? Buffer.from(value, 'base64').toString('utf8') : '';
}

export function encodedPluginBytes(value: string): string {
  return Buffer.from(value).toString('base64');
}

function requestObject(data: Uint8Array): Record<string, unknown> {
  const value: unknown = JSON.parse(new TextDecoder().decode(data));

  if (!isJsonObject(value)) throw new Error('response interceptor request is invalid');

  return value;
}

function registrationAnswer(capabilities: Capabilities): Uint8Array {
  return encoded({
    ok: true,
    result: {
      schema_version: 2,
      metadata: { name: 'response interceptor' },
      capabilities: {
        request_interceptor: capabilities.request === true,
        response_interceptor: capabilities.response === true,
        response_stream_interceptor: capabilities.stream === true,
      },
    },
  });
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
