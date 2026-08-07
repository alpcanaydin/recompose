import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel, neverFetches } from './gateway-app.testkit';
import { isJsonObject } from './gateway-wire';
import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';

const grant: SpendGrant = {
  verdict: 'resolved',
  providerOrigin: 'plugin://plugin-provider',
  spend: {
    custody: 'credentialed',
    provider: 'plugin-provider',
    credential: '{"token":"plugin-secret"}',
    accountId: 'acc-plugin',
  },
};

describe('gateway plugin executor inference', () => {
  it('should serve a direct plugin provider without reaching fetch', async () => {
    const fixture = await pluginFixture();
    const app = gatewayWith(fixture.host);

    const answer = await app.request('http://127.0.0.1:8397/v1/chat/completions', {
      method: 'POST',
      headers: { 'x-session-id': 'plugin-session' },
      body: JSON.stringify({
        model: 'fast',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });
    const body: unknown = await answer.json();
    const sent = fixture.requests.get(pluginMethods.executorExecute);

    expect(body).toMatchObject({ choices: [{ message: { content: 'plugin answer' } }] });
    expect(sent).toMatchObject({
      AuthID: 'acc-plugin',
      AuthProvider: 'plugin-provider',
      Model: 'plugin-model',
      SourceFormat: 'chat-completions',
      Format: 'chat-completions',
      StorageJSON: 'eyJ0b2tlbiI6InBsdWdpbi1zZWNyZXQifQ==',
    });
  });

  it('should stream plugin chunks through the gateway', async () => {
    const fixture = await pluginFixture();
    const app = gatewayWith(fixture.host);

    const answer = await app.request('http://127.0.0.1:8397/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        stream: true,
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    expect(answer.headers.get('content-type')).toContain('text/event-stream');
    await expect(answer.text()).resolves.toContain('plugin stream');
  });
});

describe('gateway plugin executor token counting', () => {
  it('should map plugin total_tokens to Anthropic input_tokens', async () => {
    const fixture = await pluginFixture();
    const app = gatewayWith(fixture.host);

    const answer = await app.request('http://127.0.0.1:8397/v1/messages/count_tokens', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    await expect(answer.json()).resolves.toEqual({ input_tokens: 17 });
    expect(fixture.requests.has(pluginMethods.executorCountTokens)).toBe(true);
  });
});

describe('gateway plugin model routing', () => {
  it('should route a native target through the selected plugin executor', async () => {
    const plugins = await routerFixture();
    const nativeGrant: SpendGrant = {
      verdict: 'resolved',
      providerOrigin: 'https://api.anthropic.com',
      spend: {
        custody: 'credentialed',
        provider: 'anthropic',
        credential: 'native-secret',
        accountId: 'acc-anthropic',
      },
    };
    const app = gatewayWith(plugins, nativeGrant);

    const answer = await app.request('http://127.0.0.1:8397/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    await expect(answer.json()).resolves.toMatchObject({
      choices: [{ message: { content: 'plugin answer' } }],
    });
  });
});

// Helpers

function gatewayWith(plugins: PluginHost, selectedGrant: SpendGrant = grant) {
  const model = aVirtualModel({
    target: { standing: 'bound', providerModel: 'plugin-model' },
  });

  return createGatewayApp(
    aGatewayHolding(model),
    async () => Promise.resolve(selectedGrant),
    neverFetches,
    undefined,
    undefined,
    undefined,
    plugins,
  );
}

async function routerFixture(): Promise<PluginHost> {
  const router = routerClient();
  const executor = executorClient();
  const clients = new Map<string, PluginClient>([
    ['/router', router],
    ['/executor', executor],
  ]);
  const host = new PluginHost((path) => {
    const client = clients.get(path);

    if (client === undefined) throw new Error('missing plugin client');

    return client;
  });

  await host.load('router', '/router', new Uint8Array(), 10);
  await host.load('executor', '/executor', new Uint8Array(), 1);

  return host;
}

function routerClient(): PluginClient {
  return {
    call: async (method) => {
      await Promise.resolve();

      return method === pluginMethods.modelRoute
        ? encoded({
            ok: true,
            result: { Handled: true, TargetKind: 'executor', Target: 'executor' },
          })
        : encoded({
            ok: true,
            result: {
              schema_version: 2,
              metadata: { name: 'router' },
              capabilities: { model_router: true },
            },
          });
    },
    shutdown: () => undefined,
  };
}

function executorClient(): PluginClient {
  return {
    call: async (method) => {
      await Promise.resolve();

      return pluginAnswer(method);
    },
    shutdown: () => undefined,
  };
}

async function pluginFixture() {
  const requests = new Map<string, Record<string, unknown>>();
  const client: PluginClient = {
    call: async (method, request) => {
      await Promise.resolve();
      const parsed: unknown = JSON.parse(new TextDecoder().decode(request));

      if (isJsonObject(parsed)) requests.set(method, parsed);

      return pluginAnswer(method);
    },
    shutdown: () => undefined,
  };
  const host = new PluginHost(() => client);

  await host.load('plugin-executor', '/plugin-executor');

  return { host, requests };
}

function pluginAnswer(method: string): Uint8Array {
  if (method === pluginMethods.register) return registrationAnswer();

  if (method === 'executor.identifier') {
    return encoded({ ok: true, result: { identifier: 'plugin-provider' } });
  }

  if (method === pluginMethods.executorStream) return streamAnswer();

  if (method === pluginMethods.executorCountTokens) {
    return encoded({
      ok: true,
      result: { Payload: Buffer.from('{"total_tokens":17}').toString('base64') },
    });
  }

  return encoded({
    ok: true,
    result: {
      Payload: Buffer.from(
        JSON.stringify({
          id: 'chatcmpl_plugin',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'plugin answer' },
              finish_reason: 'stop',
            },
          ],
        }),
      ).toString('base64'),
      Headers: { 'content-type': ['application/json'] },
    },
  });
}

function registrationAnswer(): Uint8Array {
  return encoded({
    ok: true,
    result: {
      schema_version: 2,
      metadata: { name: 'plugin executor' },
      capabilities: {
        executor: true,
        executor_model_scope: 'both',
        executor_input_formats: ['chat-completions', 'anthropic'],
        executor_output_formats: ['chat-completions'],
      },
    },
  });
}

function streamAnswer(): Uint8Array {
  const event = JSON.stringify({
    id: 'chatcmpl_plugin',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: { content: 'plugin stream' }, finish_reason: 'stop' }],
  });

  return encoded({
    ok: true,
    result: {
      headers: { 'content-type': ['text/event-stream'] },
      chunks: [{ Payload: Buffer.from(`data: ${event}\n\ndata: [DONE]\n\n`).toString('base64') }],
    },
  });
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
