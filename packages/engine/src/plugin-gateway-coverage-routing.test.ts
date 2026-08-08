import type { SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import type { Crossing } from './gateway-wire';
import type { PluginClient } from './plugin-abi';

import { pluginMethods } from './plugin-abi';
import { pluginGatewayTarget } from './plugin-gateway';
import { PluginHost } from './plugin-host';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

describe('plugin gateway target selection', () => {
  it('should send the crossing to the provider the router names', async () => {
    const plugins = await routedHost({
      Handled: true,
      TargetKind: 'provider',
      Target: 'anthropic',
      TargetModel: 'claude-sonnet-4',
    });

    const target = await pluginGatewayTarget(
      await requestContext(),
      crossing(),
      grantFor('anthropic'),
      plugins,
    );

    expect(target).toEqual({ kind: 'provider', providerModel: 'claude-sonnet-4' });
  });

  it('should refuse a routed executor that speaks no dialect this gateway knows', async () => {
    const plugins = await routedHost(
      { Handled: true, TargetKind: 'executor', Target: 'executor' },
      ['cobol'],
    );

    const target = await pluginGatewayTarget(
      await requestContext(),
      crossing(),
      grantFor('anthropic'),
      plugins,
    );

    expect(target).toBeNull();
  });

  it('should hand a routed executor the dialect both sides speak', async () => {
    const plugins = await routedHost({ Handled: true, TargetKind: 'executor', Target: 'executor' });

    const target = await pluginGatewayTarget(
      await requestContext(),
      crossing(),
      grantFor('anthropic'),
      plugins,
    );

    expect(target).toMatchObject({
      kind: 'executor',
      inputDialect: 'chat-completions',
      outputDialect: 'chat-completions',
    });
  });
});

describe('plugin gateway fallback to the account provider', () => {
  it('should serve the account provider from its own executor when no router claims it', async () => {
    const plugins = await routedHost({ Handled: false });

    const target = await pluginGatewayTarget(
      await requestContext(),
      crossing(),
      grantFor('plugin-provider'),
      plugins,
    );

    expect(target).toMatchObject({ kind: 'executor' });
  });

  it('should offer an open account no provider for a plugin to claim', async () => {
    const plugins = await routedHost({ Handled: false });

    const target = await pluginGatewayTarget(
      await requestContext(),
      crossing(),
      openGrant(),
      plugins,
    );

    expect(target).toBeNull();
  });
});

describe('plugin gateway request metadata', () => {
  it('should record the caller headers and query on the crossing it inspects', async () => {
    const plugins = await routedHost({ Handled: false });
    const carried = crossing();

    await pluginGatewayTarget(await requestContext(), carried, grantFor('anthropic'), plugins);

    expect(carried.requestHeaders).toMatchObject({ 'x-session-id': ['session-1'] });
    expect(carried.requestQuery).toEqual({ alt: ['sse'] });
  });

  it('should stay out of the way when the gateway hosts no plugins', async () => {
    const target = await pluginGatewayTarget(
      await requestContext(),
      crossing(),
      grantFor('anthropic'),
    );

    expect(target).toBeNull();
  });
});

async function requestContext(): Promise<Context> {
  const captured: Context[] = [];
  const app = new Hono();

  app.all('*', (c) => {
    captured.push(c);

    return c.text('ok');
  });

  await app.request('http://127.0.0.1:8397/v1/chat/completions?alt=sse', {
    headers: { 'x-session-id': 'session-1' },
  });

  const context = captured[0];

  if (context === undefined) throw new Error('the request never reached a handler');

  return context;
}

async function routedHost(route: Record<string, unknown>, formats?: string[]): Promise<PluginHost> {
  const clients = new Map<string, PluginClient>([
    ['/router', routerClient(route)],
    ['/executor', executorClient(formats ?? ['chat-completions', 'anthropic'])],
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

function executorClient(formats: readonly string[]): PluginClient {
  return {
    call: async (method) => {
      await Promise.resolve();

      if (method === 'executor.identifier') {
        return encoded({ ok: true, result: { identifier: 'plugin-provider' } });
      }

      if (method === pluginMethods.register) return registrationAnswer(formats);

      return encoded({ ok: true, result: {} });
    },
    shutdown: () => undefined,
  };
}

function registrationAnswer(formats: readonly string[]): Uint8Array {
  return encoded({
    ok: true,
    result: {
      schema_version: 2,
      metadata: { name: 'executor' },
      capabilities: {
        executor: true,
        executor_model_scope: 'both',
        executor_input_formats: [...formats],
        executor_output_formats: [...formats],
      },
    },
  });
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
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

function grantFor(provider: string): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'plugin://provider',
    spend: {
      custody: 'credentialed',
      provider,
      credential: 'plugin-secret',
      accountId: 'acc-plugin',
    },
  };
}

function openGrant(): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'http://127.0.0.1:11434',
    spend: { custody: 'open' },
  };
}
