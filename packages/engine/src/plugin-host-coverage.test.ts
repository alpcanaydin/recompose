import { describe, expect, it, vi } from 'vitest';

import type { PluginClient } from './plugin-abi';

import { PluginHost } from './plugin-host';

type Fake = { client: PluginClient; shutdown: ReturnType<typeof vi.fn>; fail: boolean };

function fake(result: unknown): Fake {
  const shutdown = vi.fn();
  const state: Fake = {
    shutdown,
    fail: false,
    client: {
      call: async () => {
        await Promise.resolve();

        if (state.fail) throw new Error('boom');

        return new TextEncoder().encode(JSON.stringify({ ok: true, result }));
      },
      shutdown: () => {
        shutdown();
      },
    },
  };

  return state;
}

function registrationOf(name: string, requestLifecycle = false): unknown {
  return {
    schema_version: 2,
    metadata: { name },
    capabilities: { request_lifecycle_plugin: requestLifecycle },
  };
}

describe('PluginHost registration validation', () => {
  it('should refuse a registration that is not an object', async () => {
    const host = new PluginHost(() => fake('not-an-object').client);

    await expect(host.load('odd', '/plugins/odd.so')).rejects.toThrow(
      'plugin registration is not an object',
    );
  });

  it('should refuse a registration whose schema version is not a whole number', async () => {
    const host = new PluginHost(() => fake({ schema_version: 2.5 }).client);

    await expect(host.load('fractional', '/plugins/fractional.so')).rejects.toThrow(
      'plugin registration schema version is invalid',
    );
  });

  it('should refuse a registration whose metadata is not an object', async () => {
    const registration = { schema_version: 2, metadata: 'sample', capabilities: {} };
    const host = new PluginHost(() => fake(registration).client);

    await expect(host.load('flat', '/plugins/flat.so')).rejects.toThrow(
      'plugin registration metadata or capabilities are invalid',
    );
  });
});

describe('PluginHost addressing a plugin that was never loaded', () => {
  it('should ignore a request to disable it', () => {
    const host = new PluginHost(() => fake(registrationOf('sample')).client);

    host.disable('ghost');

    expect(host.registered('ghost')).toBe(false);
  });

  it('should refuse a capability call against it', async () => {
    const host = new PluginHost(() => fake(registrationOf('sample')).client);

    await expect(host.call('ghost', 'executor.execute', {}, String)).rejects.toThrow(
      'plugin ghost is not registered',
    );
  });

  it('should ignore a request completion addressed to it', () => {
    const host = new PluginHost(() => fake(registrationOf('sample')).client);

    expect(() => {
      host.completeRequest('ghost', { request_id: 'request-1' });
    }).not.toThrow();
  });
});

describe('PluginHost ordering', () => {
  it('should rank by priority first and settle ties by plugin name', async () => {
    const host = new PluginHost((path) => fake(registrationOf(path)).client);

    await host.load('b', 'beta', new Uint8Array(), 1);
    await host.load('a', 'alpha', new Uint8Array(), 1);
    await host.load('c', 'gamma', new Uint8Array(), 5);

    expect(host.snapshot().map((entry) => entry.metadata['name'])).toStrictEqual([
      'gamma',
      'alpha',
      'beta',
    ]);
    expect(host.routingRecords().map((record) => record.id)).toStrictEqual(['c', 'a', 'b']);
  });
});

describe('PluginHost fuse', () => {
  it('should shut a plugin down once however many completions were in flight', async () => {
    const plugin = fake(registrationOf('sample', true));
    const host = new PluginHost(() => plugin.client);

    await host.load('sample', '/plugins/sample.so');
    plugin.fail = true;
    host.completeRequest('sample', { request_id: 'request-1' });
    host.completeRequest('sample', { request_id: 'request-2' });

    await vi.waitFor(() => {
      expect(plugin.shutdown).toHaveBeenCalledOnce();
    });
  });
});
