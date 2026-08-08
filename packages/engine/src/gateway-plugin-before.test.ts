import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  aVirtualModel,
  bodySentIn,
  fetchAnsweringWith,
  neverFetches,
} from './gateway-app.testkit';
import { isJsonObject } from './gateway-wire';
import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';

describe('gateway before-auth plugin rewriting', () => {
  it('should send the plugin-rewritten request upstream', async () => {
    const plugin = await interceptorHost(() => ({
      Body: Buffer.from(
        JSON.stringify({
          model: 'fast',
          messages: [{ role: 'user', content: 'rewritten' }],
        }),
      ).toString('base64'),
    }));
    const upstream = fetchAnsweringWith(chatAnswer);
    const app = gateway(plugin.host, upstream.fetchLike);

    const answer = await ask(app);

    expect(bodySentIn(upstream.sent)).toMatchObject({
      messages: [{ role: 'user', content: 'rewritten' }],
    });
    expect(plugin.methods).toContain(pluginMethods.requestInterceptBefore);
    expect(plugin.methods).toContain(pluginMethods.requestInterceptAfter);
    expect(answer.status).toBe(200);
  });
});

describe('gateway before-auth plugin termination', () => {
  it('should return the plugin response without resolving a grant or fetching', async () => {
    const plugin = await interceptorHost(() => ({
      Terminate: true,
      StatusCode: 451,
      ResponseHeaders: { 'content-type': ['application/json'], 'x-plugin': ['blocked'] },
      ResponseBody: Buffer.from('{"error":"blocked"}').toString('base64'),
    }));
    const asked: string[] = [];
    const app = createGatewayApp(
      aGatewayHolding(aVirtualModel()),
      async (_slug, model) => {
        await Promise.resolve();
        asked.push(model);

        return aCredentialedGrant();
      },
      neverFetches,
      undefined,
      undefined,
      undefined,
      plugin.host,
    );

    const answer = await ask(app);

    expect(answer.status).toBe(451);
    expect(answer.headers.get('x-plugin')).toBe('blocked');
    await expect(answer.json()).resolves.toEqual({ error: 'blocked' });
    expect(asked).toEqual([]);
  });
});

// Helpers

function gateway(plugins: PluginHost, fetchLike: typeof fetch) {
  return createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    async () => Promise.resolve(aCredentialedGrant('https://api.openai.com', 'openai')),
    fetchLike,
    undefined,
    undefined,
    undefined,
    plugins,
  );
}

async function ask(app: ReturnType<typeof createGatewayApp>): Promise<Response> {
  return app.request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      messages: [{ role: 'user', content: 'original' }],
    }),
  });
}

async function interceptorHost(answer: () => Record<string, unknown>) {
  const methods: string[] = [];
  const client: PluginClient = {
    call: async (method, request) => {
      await Promise.resolve();
      methods.push(method);

      if (method === pluginMethods.register) return registrationAnswer();

      const parsed: unknown = JSON.parse(new TextDecoder().decode(request));

      if (!isJsonObject(parsed)) throw new Error('plugin request is not an object');

      return encoded({ ok: true, result: answer() });
    },
    shutdown: () => undefined,
  };
  const host = new PluginHost(() => client);

  await host.load('interceptor', '/interceptor');

  return { host, methods };
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

function chatAnswer(): Response {
  return Response.json({
    id: 'chatcmpl_1',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'ok' },
        finish_reason: 'stop',
      },
    ],
  });
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
