import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';
import type { PluginRequestIntercept } from './plugin-request-interceptors';

import { isJsonObject } from './gateway-wire';
import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';
import { interceptPluginRequest } from './plugin-request-interceptors';

describe('plugin request interceptor priority chain', () => {
  it('should chain body/header changes without mutating the input', async () => {
    const high = interceptorPlugin((request) => ({
      Headers: { 'x-plugin': ['high'] },
      Body: bodyWith(request, '|high'),
    }));
    const low = interceptorPlugin((request) => ({
      Headers: { 'x-plugin': ['low'], 'x-low': ['1'] },
      ClearHeaders: ['x-remove'],
      Body: bodyWith(request, '|low'),
    }));
    const host = await interceptorHost([
      ['low', 10, low],
      ['high', 20, high],
    ]);
    const request = requestFixture();

    const result = await interceptPluginRequest(host, 'before', request);

    expect(new TextDecoder().decode(result.body)).toBe('start|high|low');
    expect(result.headers).toEqual({ 'x-plugin': ['low'], 'x-low': ['1'] });
    expect(request.headers).toEqual({ 'x-remove': ['yes'] });
    expect(new TextDecoder().decode(request.body)).toBe('start');
  });

  it('should pass the selected target format after auth', async () => {
    let toFormat = '';
    const plugin = interceptorPlugin((request) => {
      toFormat = readString(request, 'ToFormat');

      return { Body: bodyWith(request, '|after') };
    });
    const host = await interceptorHost([['after', 1, plugin]]);
    const request = { ...requestFixture(), toFormat: 'responses' };

    const result = await interceptPluginRequest(host, 'after', request);

    expect(toFormat).toBe('responses');
    expect(new TextDecoder().decode(result.body)).toBe('start|after');
    expect(plugin.methods).toContain(pluginMethods.requestInterceptAfter);
  });
});

describe('plugin request interceptor termination', () => {
  it('should terminate with downstream response and skip lower priority plugins', async () => {
    const high = interceptorPlugin(() => ({
      Terminate: true,
      StatusCode: 999,
      ResponseHeaders: { 'content-type': ['application/json'] },
      ResponseBody: Buffer.from('{"error":"blocked"}').toString('base64'),
    }));
    const low = interceptorPlugin(() => ({ Body: Buffer.from('unexpected').toString('base64') }));
    const host = await interceptorHost([
      ['low', 1, low],
      ['high', 10, high],
    ]);

    const result = await interceptPluginRequest(host, 'before', requestFixture());

    expect(result).toMatchObject({
      terminate: true,
      statusCode: 403,
      responseHeaders: { 'content-type': ['application/json'] },
    });
    expect(new TextDecoder().decode(result.responseBody)).toBe('{"error":"blocked"}');
    expect(low.methods).not.toContain(pluginMethods.requestInterceptBefore);
  });

  it('should skip the originating plugin', async () => {
    const origin = interceptorPlugin((request) => ({ Body: bodyWith(request, '|origin') }));
    const other = interceptorPlugin((request) => ({ Body: bodyWith(request, '|other') }));
    const host = await interceptorHost([
      ['origin', 10, origin],
      ['other', 1, other],
    ]);

    const result = await interceptPluginRequest(host, 'before', requestFixture(), 'origin');

    expect(new TextDecoder().decode(result.body)).toBe('start|other');
    expect(origin.methods).not.toContain(pluginMethods.requestInterceptBefore);
  });
});

describe('plugin request interceptor failures', () => {
  it('should fuse a failing interceptor and continue the chain', async () => {
    const broken = interceptorPlugin(() => {
      throw new Error('broken interceptor');
    });
    const fallback = interceptorPlugin((request) => ({ Body: bodyWith(request, '|fallback') }));
    const host = await interceptorHost([
      ['broken', 10, broken],
      ['fallback', 1, fallback],
    ]);

    const result = await interceptPluginRequest(host, 'before', requestFixture());

    expect(new TextDecoder().decode(result.body)).toBe('start|fallback');
    expect(host.routingRecords().map(({ id }) => id)).toEqual(['fallback']);
  });
});

// Helpers

type InterceptorAnswer = (request: Record<string, unknown>) => Record<string, unknown>;

function interceptorPlugin(answer: InterceptorAnswer) {
  const methods: string[] = [];
  const client: PluginClient = {
    call: async (method, data) => {
      await Promise.resolve();
      methods.push(method);

      if (method === pluginMethods.register) return registrationAnswer();

      const request = requestObject(data);

      return encoded({ ok: true, result: answer(request) });
    },
    shutdown: () => undefined,
  };

  return { client, methods };
}

async function interceptorHost(
  plugins: readonly [id: string, priority: number, plugin: ReturnType<typeof interceptorPlugin>][],
): Promise<PluginHost> {
  const clients = new Map(plugins.map(([id, _priority, plugin]) => [id, plugin.client]));
  const host = new PluginHost((path) => {
    const client = clients.get(path);

    if (client === undefined) throw new Error(`missing interceptor ${path}`);

    return client;
  });

  for (const [id, priority] of plugins) await host.load(id, id, new Uint8Array(), priority);

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
    headers: { 'x-remove': ['yes'] },
    body: new TextEncoder().encode('start'),
    metadata: { tenant: 'demo' },
  };
}

function bodyWith(request: Record<string, unknown>, suffix: string): string {
  const body = request['Body'];
  const current = typeof body === 'string' ? Buffer.from(body, 'base64').toString('utf8') : '';

  return Buffer.from(`${current}${suffix}`).toString('base64');
}

function readString(request: Record<string, unknown>, key: string): string {
  return typeof request[key] === 'string' ? request[key] : '';
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
      metadata: { name: 'interceptor' },
      capabilities: { request_interceptor: true },
    },
  });
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
