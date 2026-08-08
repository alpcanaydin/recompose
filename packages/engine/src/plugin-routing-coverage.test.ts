import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';
import type { ModelRouteRequest, SchedulerRequest } from './plugin-routing';

import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';

type Capabilities = Record<string, boolean>;

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function answeringClient(capabilities: Capabilities, answers: Record<string, unknown>) {
  const client: PluginClient = {
    call: async (method) => {
      await Promise.resolve();

      if (method === pluginMethods.register || method === pluginMethods.reconfigure) {
        return encoded({
          ok: true,
          result: { schema_version: 2, metadata: { name: 'plugin' }, capabilities },
        });
      }

      return encoded({ ok: true, result: answers[method] ?? {} });
    },
    shutdown: () => undefined,
  };

  return client;
}

async function hostOf(
  capabilities: Capabilities,
  answers: Record<string, unknown> = {},
): Promise<PluginHost> {
  const host = new PluginHost(() => answeringClient(capabilities, answers));

  await host.load('router', '/router', new Uint8Array(), 1);

  return host;
}

function schedulerRequest(): SchedulerRequest {
  return {
    provider: 'openai',
    providers: ['openai'],
    model: 'gpt-test',
    stream: false,
    headers: {},
    metadata: {},
    candidates: [
      {
        id: 'auth-1',
        provider: 'openai',
        priority: 10,
        status: 'ready',
        attributes: {},
        metadata: {},
      },
    ],
  };
}

function modelRouteRequest(): ModelRouteRequest {
  return {
    sourceFormat: 'anthropic',
    requestedModel: 'claude-sonnet',
    stream: false,
    headers: {},
    query: {},
    body: new Uint8Array(),
    metadata: {},
    availableProviders: ['anthropic'],
  };
}

describe('picking an auth when no plugin schedules', () => {
  it('leaves the choice unhandled', async () => {
    const host = await hostOf({ model_router: true });

    await expect(host.pickAuth(schedulerRequest())).resolves.toEqual({ handled: false });
  });
});

describe('a scheduler plugin answering with something that is not an object', () => {
  it('refuses the answer instead of guessing an auth', async () => {
    const host = await hostOf({ scheduler: true }, { [pluginMethods.schedulerPick]: 'auth-1' });

    await expect(host.pickAuth(schedulerRequest())).rejects.toThrow(
      'scheduler response is not an object',
    );
  });
});

describe('a model router answering with something that is not an object', () => {
  it('falls through to the built-in routing', async () => {
    const host = await hostOf(
      { model_router: true },
      { [pluginMethods.modelRoute]: ['anthropic'] },
    );

    await expect(host.routeModel(modelRouteRequest())).resolves.toEqual({ handled: false });
  });
});

describe('a model router naming a target the gateway cannot reach', () => {
  it('refuses to route to itself when it cannot execute', async () => {
    const host = await hostOf(
      { model_router: true },
      { [pluginMethods.modelRoute]: { Handled: true } },
    );

    await expect(host.routeModel(modelRouteRequest())).resolves.toEqual({ handled: false });
  });

  it('refuses to route to a provider that is not available', async () => {
    const host = await hostOf(
      { model_router: true },
      {
        [pluginMethods.modelRoute]: { Handled: true, TargetKind: 'provider', Target: 'openai' },
      },
    );

    await expect(host.routeModel(modelRouteRequest())).resolves.toEqual({ handled: false });
  });
});
