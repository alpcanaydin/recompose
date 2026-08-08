import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  aVirtualModel,
  bodySentIn,
  fetchAnsweringWith,
  granting,
} from './gateway-app.testkit';
import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function routerClient(route: Record<string, unknown>): PluginClient {
  return {
    call: async (method) => {
      await Promise.resolve();

      return method === pluginMethods.modelRoute
        ? encoded({ ok: true, result: route })
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

      if (method === 'executor.identifier') {
        return encoded({ ok: true, result: { identifier: 'plugin-provider' } });
      }

      return method === pluginMethods.register
        ? encoded({
            ok: true,
            result: {
              schema_version: 2,
              metadata: { name: 'executor' },
              capabilities: {
                executor: true,
                executor_model_scope: 'both',
                executor_input_formats: ['anthropic'],
                executor_output_formats: ['anthropic'],
              },
            },
          })
        : encoded({ ok: true, result: {} });
    },
    shutdown: () => undefined,
  };
}

async function routingHost(route: Record<string, unknown>): Promise<PluginHost> {
  const clients = new Map<string, PluginClient>([
    ['/router', routerClient(route)],
    ['/executor', executorClient()],
  ]);
  const host = new PluginHost((path) => {
    const client = clients.get(path);

    if (client === undefined) throw new Error(`no plugin client for ${path}`);

    return client;
  });

  await host.load('router', '/router', new Uint8Array(), 10);
  await host.load('executor', '/executor', new Uint8Array(), 1);

  return host;
}

async function chatAnswer(route: Record<string, unknown>, body: Record<string, unknown>) {
  const answering = fetchAnsweringWith(() =>
    Response.json({ id: 'chatcmpl-1', choices: [], model: 'answer' }),
  );
  const app = createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    granting(aCredentialedGrant('http://127.0.0.1:4242', 'openai')).grantFor,
    answering.fetchLike,
    undefined,
    undefined,
    undefined,
    await routingHost(route),
  );

  const answer = await app.request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return { answer, sent: answering.sent };
}

describe('forwarding through the provider a plugin router names', () => {
  it('should send the model the router chose rather than the bound one', async () => {
    const { sent } = await chatAnswer(
      {
        Handled: true,
        TargetKind: 'provider',
        Target: 'openai',
        TargetModel: 'gpt-5-router-choice',
      },
      { model: 'fast', messages: [{ role: 'user', content: 'hello' }] },
    );

    expect(bodySentIn(sent)).toMatchObject({ model: 'gpt-5-router-choice' });
  });

  it('should send the bound model when the router names none', async () => {
    const { sent } = await chatAnswer(
      { Handled: true, TargetKind: 'provider', Target: 'openai' },
      { model: 'fast', messages: [{ role: 'user', content: 'hello' }] },
    );

    expect(bodySentIn(sent)).toMatchObject({ model: 'gpt-5-mini' });
  });
});

describe('forwarding to a plugin executor that speaks another dialect', () => {
  it('should refuse a conversation the executor dialect cannot carry', async () => {
    const { answer, sent } = await chatAnswer(
      { Handled: true, TargetKind: 'executor', Target: 'executor' },
      { model: 'fast', messages: [] },
    );

    expect(answer.status).toBe(400);
    expect(sent).toEqual([]);
    expect(await answer.json()).toMatchObject({
      error: { message: 'The request carries no message to translate.' },
    });
  });
});
