import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';
import type { ModelRouteRequest, SchedulerRequest } from './plugin-routing';

import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';

describe('plugin scheduler routing', () => {
  it('should call only the highest-priority scheduler when it is unhandled', async () => {
    const high = scriptedPlugin({ scheduler: true });
    const low = scriptedPlugin({ scheduler: true });

    high.answer(pluginMethods.schedulerPick, { Handled: false });
    low.answer(pluginMethods.schedulerPick, { Handled: true, AuthID: 'auth-1' });
    const host = await loadedHost([
      ['low', 1, low],
      ['high', 10, high],
    ]);

    await expect(host.pickAuth(schedulerRequest())).resolves.toEqual({ handled: false });
    expect(high.methods).toContain(pluginMethods.schedulerPick);
    expect(low.methods).not.toContain(pluginMethods.schedulerPick);
  });

  it('should accept a known auth ID before an invalid delegate', async () => {
    const plugin = scriptedPlugin({ scheduler: true });

    plugin.answer(pluginMethods.schedulerPick, {
      Handled: true,
      AuthID: 'auth-1',
      DelegateBuiltin: 'unknown',
    });
    const host = await loadedHost([['scheduler', 1, plugin]]);

    await expect(host.pickAuth(schedulerRequest())).resolves.toMatchObject({
      handled: true,
      authId: 'auth-1',
    });
  });

  it('should accept known built-in delegates and reject invalid decisions', async () => {
    const plugin = scriptedPlugin({ scheduler: true });
    const host = await loadedHost([['scheduler', 1, plugin]]);

    plugin.answer(pluginMethods.schedulerPick, { Handled: true, DelegateBuiltin: 'fill-first' });
    await expect(host.pickAuth(schedulerRequest())).resolves.toEqual({
      handled: true,
      delegateBuiltin: 'fill-first',
    });

    plugin.answer(pluginMethods.schedulerPick, { Handled: true, AuthID: 'missing' });
    await expect(host.pickAuth(schedulerRequest())).resolves.toEqual({ handled: false });
  });
});

describe('plugin model routing priority', () => {
  it('should continue after unhandled and choose the next self executor', async () => {
    const high = scriptedPlugin({ model_router: true });
    const low = scriptedPlugin({ model_router: true, executor: true });

    high.answer(pluginMethods.modelRoute, { Handled: false });
    low.answer(pluginMethods.modelRoute, { Handled: true });
    const host = await loadedHost([
      ['low', 1, low],
      ['high', 10, high],
    ]);

    await expect(host.routeModel(modelRouteRequest())).resolves.toMatchObject({
      handled: true,
      pluginId: 'low',
      targetKind: 'self',
      target: 'low',
    });
  });

  it('should fuse a failing router and continue to a built-in provider', async () => {
    const high = scriptedPlugin({ model_router: true });
    const low = scriptedPlugin({ model_router: true });

    high.fail(pluginMethods.modelRoute);
    low.answer(pluginMethods.modelRoute, {
      Handled: true,
      TargetKind: 'provider',
      Target: 'anthropic',
      TargetModel: 'claude-sonnet-4-5',
      Reason: 'native fallback',
    });
    const host = await loadedHost([
      ['low', 1, low],
      ['high', 10, high],
    ]);

    await expect(host.routeModel(modelRouteRequest())).resolves.toMatchObject({
      handled: true,
      pluginId: 'low',
      targetKind: 'provider',
      target: 'anthropic',
      targetModel: 'claude-sonnet-4-5',
    });
    expect(host.routingRecords().map(({ id }) => id)).toEqual(['low']);
  });
});

describe('plugin model routing targets', () => {
  it('should route to an explicit available plugin executor', async () => {
    const router = scriptedPlugin({ model_router: true });
    const executor = scriptedPlugin({ executor: true });

    router.answer(pluginMethods.modelRoute, {
      Handled: true,
      TargetKind: 'executor',
      Target: 'executor',
    });
    const host = await loadedHost([
      ['router', 10, router],
      ['executor', 1, executor],
    ]);

    await expect(host.routeModel(modelRouteRequest())).resolves.toMatchObject({
      handled: true,
      targetKind: 'executor',
      target: 'executor',
    });
  });

  it('should reject unavailable targets and skip the originating plugin', async () => {
    const router = scriptedPlugin({ model_router: true, executor: true });

    router.answer(pluginMethods.modelRoute, {
      Handled: true,
      TargetKind: 'executor',
      Target: 'missing',
    });
    const host = await loadedHost([['router', 1, router]]);

    await expect(host.routeModel(modelRouteRequest())).resolves.toEqual({ handled: false });
    await expect(host.routeModel(modelRouteRequest(), 'router')).resolves.toEqual({
      handled: false,
    });
  });
});

// Helpers

type CapabilityFlags = Record<string, boolean>;

function scriptedPlugin(capabilities: CapabilityFlags) {
  const methods: string[] = [];
  const answers = new Map<string, unknown>();
  const failures = new Set<string>();
  const client: PluginClient = {
    call: async (method, _request) => {
      await Promise.resolve();
      methods.push(method);

      if (failures.has(method)) throw new Error('plugin failure');

      if (method === pluginMethods.register || method === pluginMethods.reconfigure) {
        return encoded({
          ok: true,
          result: { schema_version: 2, metadata: { name: 'plugin' }, capabilities },
        });
      }

      return encoded({ ok: true, result: answers.get(method) ?? {} });
    },
    shutdown: () => undefined,
  };

  return {
    client,
    methods,
    answer: (method: string, value: unknown) => {
      answers.set(method, value);
    },
    fail: (method: string) => {
      failures.add(method);
    },
  };
}

async function loadedHost(
  plugins: readonly [id: string, priority: number, plugin: ReturnType<typeof scriptedPlugin>][],
): Promise<PluginHost> {
  const clients = new Map(plugins.map(([id, _priority, plugin]) => [`/${id}`, plugin.client]));
  const host = new PluginHost((path) => {
    const client = clients.get(path);

    if (client === undefined) throw new Error(`missing scripted plugin ${path}`);

    return client;
  });

  for (const [id, priority] of plugins) await host.load(id, `/${id}`, new Uint8Array(), priority);

  return host;
}

function schedulerRequest(): SchedulerRequest {
  return {
    provider: 'openai',
    providers: ['openai'],
    model: 'gpt-test',
    stream: false,
    headers: { 'x-test': ['1'] },
    metadata: { tenant: 'demo' },
    candidates: [
      {
        id: 'auth-1',
        provider: 'openai',
        priority: 10,
        status: 'ready',
        attributes: { region: 'us' },
        metadata: { load: 0.5 },
      },
    ],
  };
}

function modelRouteRequest(): ModelRouteRequest {
  return {
    sourceFormat: 'anthropic',
    requestedModel: 'claude-sonnet',
    stream: true,
    headers: { 'x-test': ['1'] },
    query: { beta: ['true'] },
    body: new TextEncoder().encode('{"model":"claude-sonnet"}'),
    metadata: { tenant: 'demo' },
    availableProviders: ['anthropic'],
  };
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
