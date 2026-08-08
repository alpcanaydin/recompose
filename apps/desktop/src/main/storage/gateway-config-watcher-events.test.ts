import type { GatewayConfig } from '@recompose/contracts';

import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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

describe('GatewayConfigWatcher reading a change event without a usable name', () => {
  it('should refresh every gateway when the event names no file', async () => {
    vi.useFakeTimers();
    const fixture = await watcherFixture();

    await fixture.watcher.start();
    await saveGatewayConfig(fixture.directory, gateway('Build'));
    fixture.events[0]?.change(null);
    await vi.advanceTimersByTimeAsync(75);

    await vi.waitFor(() => {
      expect(displayNames(fixture.upserts)).toEqual(['Build']);
    });
  });

  it('should change nothing when the event names a blank file', async () => {
    vi.useFakeTimers();
    const fixture = await watcherFixture();

    await fixture.watcher.start();
    await saveGatewayConfig(fixture.directory, gateway('Build'));
    fixture.events[0]?.change('   ');
    await vi.advanceTimersByTimeAsync(200);

    expect(fixture.upserts).toEqual([]);
  });
});

describe('GatewayConfigWatcher refreshing after the debounce', () => {
  it('should report a directory that stopped being readable', async () => {
    vi.useFakeTimers();
    const fixture = await watcherFixture();

    await fixture.watcher.start();
    await rm(fixture.directory, { recursive: true });
    await writeFile(fixture.directory, 'a file now stands where the directory was', 'utf8');
    fixture.events[0]?.change('codex.json');
    await vi.advanceTimersByTimeAsync(75);

    await vi.waitFor(() => {
      expect(fixture.errors).toHaveLength(1);
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

async function watcherFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-gateway-watcher-events-'));
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
      events.push(installed);

      return { close: () => undefined };
    },
  });

  return { directory, errors, events, upserts, watcher };
}
