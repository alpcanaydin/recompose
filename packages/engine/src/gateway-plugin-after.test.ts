import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  aVirtualModel,
  bodySentIn,
  fetchAnsweringWith,
  headersSentIn,
  neverFetches,
} from './gateway-app.testkit';
import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';

describe('gateway after-auth plugin rewriting', () => {
  it('should rewrite provider-ready headers and body', async () => {
    const plugin = await afterAuthHost(() => ({
      Headers: { 'x-after-plugin': ['yes'] },
      Body: Buffer.from(
        JSON.stringify({
          model: 'gpt-5-mini',
          messages: [{ role: 'user', content: 'after-auth' }],
        }),
      ).toString('base64'),
    }));
    const upstream = fetchAnsweringWith(chatAnswer);
    const app = gateway(plugin, upstream.fetchLike);

    const answer = await ask(app);

    expect(headersSentIn(upstream.sent).get('x-after-plugin')).toBe('yes');
    expect(bodySentIn(upstream.sent)).toMatchObject({
      messages: [{ role: 'user', content: 'after-auth' }],
    });
    expect(answer.status).toBe(200);
  });
});

describe('gateway after-auth plugin termination', () => {
  it('should terminate after grant resolution but before fetch', async () => {
    const plugin = await afterAuthHost(() => ({
      Terminate: true,
      StatusCode: 409,
      ResponseHeaders: { 'content-type': ['application/json'] },
      ResponseBody: Buffer.from('{"error":"after-auth blocked"}').toString('base64'),
    }));
    let grants = 0;
    const app = createGatewayApp(
      aGatewayHolding(aVirtualModel()),
      async () => {
        await Promise.resolve();
        grants += 1;

        return aCredentialedGrant('https://api.openai.com', 'openai');
      },
      neverFetches,
      undefined,
      undefined,
      undefined,
      plugin,
    );

    const answer = await ask(app);

    expect(grants).toBe(1);
    expect(answer.status).toBe(409);
    await expect(answer.json()).resolves.toEqual({ error: 'after-auth blocked' });
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

async function afterAuthHost(answer: () => Record<string, unknown>): Promise<PluginHost> {
  const client: PluginClient = {
    call: async (method) => {
      await Promise.resolve();

      if (method === pluginMethods.register) return registrationAnswer();
      if (method === pluginMethods.requestInterceptBefore) return encoded({ ok: true, result: {} });

      return encoded({ ok: true, result: answer() });
    },
    shutdown: () => undefined,
  };
  const host = new PluginHost(() => client);

  await host.load('after-auth', '/after-auth');

  return host;
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
