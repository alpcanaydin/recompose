import { describe, expect, it, vi } from 'vitest';

import type { PluginClient } from './plugin-abi';

import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';

describe('PluginHost lifecycle', () => {
  it('should register with schema two and reconfigure the existing client', async () => {
    const plugin = fakePlugin();
    const host = new PluginHost(() => plugin.client);

    await host.load('sample', '/plugins/sample.so', new TextEncoder().encode('mode: one'), 1);
    await host.load('sample', '/plugins/sample.so', new TextEncoder().encode('mode: two'), 5);

    expect(plugin.methods).toEqual([pluginMethods.register, pluginMethods.reconfigure]);
    expect(plugin.requests[0]).toMatchObject({ schema_version: 2, config_yaml: 'bW9kZTogb25l' });
    expect(host.snapshot()[0]?.metadata).toEqual({ name: 'sample' });
    expect(plugin.shutdown).not.toHaveBeenCalled();
  });

  it('should reject a future schema and shut the client down', async () => {
    const plugin = fakePlugin({ schema_version: 3 });
    const host = new PluginHost(() => plugin.client);

    await expect(host.load('future', '/plugins/future.so')).rejects.toThrow('schema version 3');
    expect(plugin.shutdown).toHaveBeenCalledOnce();
    expect(host.registered('future')).toBe(false);
  });

  it('should disable and shut down a registered plugin', async () => {
    const plugin = fakePlugin();
    const host = new PluginHost(() => plugin.client);

    await host.load('sample', '/plugins/sample.so');
    host.disable('sample');

    expect(host.registered('sample')).toBe(false);
    expect(plugin.shutdown).toHaveBeenCalledOnce();
  });
});

describe('PluginHost failure fuse', () => {
  it('should fuse a plugin after a failed capability call', async () => {
    const plugin = fakePlugin();
    const host = new PluginHost(() => plugin.client);

    await host.load('sample', '/plugins/sample.so');
    plugin.fail = true;

    await expect(host.call('sample', 'executor.execute', {}, String)).rejects.toThrow('boom');
    await expect(host.call('sample', 'executor.execute', {}, String)).rejects.toThrow('fused');
    expect(plugin.shutdown).toHaveBeenCalledOnce();
  });
});

describe('PluginHost request completion', () => {
  it('should return immediately and clone completion metadata', async () => {
    const plugin = fakePlugin(undefined, true);
    const host = new PluginHost(() => plugin.client);
    const nested = { value: 'original' };

    await host.load('sample', '/plugins/sample.so');
    host.completeRequest('sample', { request_id: 'request-1', metadata: { nested } });
    nested.value = 'mutated';

    await vi.waitFor(() => {
      expect(plugin.methods).toContain(pluginMethods.requestComplete);
    });
    expect(plugin.requests.at(-1)).toHaveProperty('metadata.nested.value', 'original');
  });
});

// Helpers

function fakePlugin(
  registration: Record<string, unknown> = { schema_version: 2 },
  requestLifecycle = false,
) {
  const methods: string[] = [];
  const requests: Record<string, unknown>[] = [];
  const shutdown = vi.fn();
  const state = {
    fail: false,
    methods,
    requests,
    shutdown,
    client: {
      call: async (method: string, request: Uint8Array) => {
        await Promise.resolve();
        methods.push(method);
        const parsed: unknown = JSON.parse(new TextDecoder().decode(request));

        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          requests.push(Object.fromEntries(Object.entries(parsed)));
        }

        if (state.fail) throw new Error('boom');

        return encoded({
          ok: true,
          result: {
            ...registration,
            metadata: { name: 'sample' },
            capabilities: { request_lifecycle_plugin: requestLifecycle },
          },
        });
      },
      shutdown: () => {
        shutdown();
      },
    } satisfies PluginClient,
  };

  return state;
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
