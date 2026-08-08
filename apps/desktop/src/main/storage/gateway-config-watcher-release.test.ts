import type { GatewayConfig } from '@recompose/contracts';

import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GatewayConfigWatcher, type GatewayWatchEvents } from './gateway-config-watcher';
import { saveGatewayConfig } from './gateway-store';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe('GatewayConfigWatcher when the directory watch cannot open', () => {
  it('should surface the failure and stay ready for a later start', async () => {
    vi.useFakeTimers();
    const refused = new Error('watch descriptors exhausted');
    const fixture = await watcherFixture([refused]);

    await expect(fixture.watcher.start()).rejects.toBe(refused);
    expect(fixture.events).toEqual([]);

    await fixture.watcher.start();
    await saveGatewayConfig(fixture.directory, gateway('Build'));
    fixture.events[0]?.change('codex.json');
    await vi.advanceTimersByTimeAsync(75);

    await vi.waitFor(() => {
      expect(displayNames(fixture.upserts)).toEqual(['Build']);
    });
  });
});

describe('GatewayConfigWatcher events from a released watch', () => {
  it('should ignore a failure raised after the watch was released', async () => {
    const fixture = await watcherFixture();

    await fixture.watcher.start();

    const released = fixture.events[0];

    fixture.watcher.close();
    released?.error(new Error('stale watch failure'));

    expect(fixture.errors).toEqual([]);
  });

  it('should keep the live watch when a released watch reports its close', async () => {
    vi.useFakeTimers();
    const fixture = await watcherFixture();

    await fixture.watcher.start();

    const released = fixture.events[0];

    fixture.watcher.close();
    await fixture.watcher.start();
    released?.close();
    await saveGatewayConfig(fixture.directory, gateway('Build'));
    fixture.events[1]?.change('codex.json');
    await vi.advanceTimersByTimeAsync(75);

    await vi.waitFor(() => {
      expect(displayNames(fixture.upserts)).toEqual(['Build']);
    });
  });
});

// Helpers

function displayNames(configs: readonly GatewayConfig[]): string[] {
  return configs.map((config) => config.displayName);
}

function gateway(displayName: string): GatewayConfig {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug: 'codex',
    displayName,
    port: 8397,
    virtualModels: [],
    layout: { nodes: {} },
  };
}

async function watcherFixture(refusals: Error[] = []) {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-gateway-watcher-release-'));
  const events: GatewayWatchEvents[] = [];
  const errors: unknown[] = [];
  const upserts: GatewayConfig[] = [];

  temporaryDirectories.push(directory);
  await saveGatewayConfig(directory, gateway('Codex'));

  const watcher = new GatewayConfigWatcher({
    directory,
    onUpsert: (config) => {
      upserts.push(config);
    },
    onRemove: () => undefined,
    onCorrupt: () => undefined,
    onError: (failure) => {
      errors.push(failure);
    },
    watchDirectory: (_directory, _signal, installed) => {
      const refusal = refusals.shift();

      if (refusal !== undefined) throw refusal;

      events.push(installed);

      return { close: () => undefined };
    },
  });

  return { directory, errors, events, upserts, watcher };
}
