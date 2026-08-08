import type { GatewayConfig } from '@recompose/contracts';

import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';

import { GatewayConfigWatcher } from './gateway-config-watcher';
import { saveGatewayConfig } from './gateway-store';

const temporaryDirectories: string[] = [];
const openWatchers: GatewayConfigWatcher[] = [];

afterEach(async () => {
  for (const watcher of openWatchers.splice(0)) watcher.close();

  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe('GatewayConfigWatcher over the real config directory', () => {
  it('should report a gateway rewritten on disk', async () => {
    const fixture = await watcherFixture();

    await fixture.watcher.start();
    await rewriteUntilReported(fixture, 'Build');

    expect(displayNames(fixture.upserts)).toEqual(['Build']);
  });

  it('should report a gateway again after a start under a shutdown signal ended', async () => {
    const shutdown = new AbortController();
    const fixture = await watcherFixture();

    await fixture.watcher.start(shutdown.signal);
    shutdown.abort();
    await saveGatewayConfig(fixture.directory, gateway('Build'));
    await fixture.watcher.start();
    await rewriteUntilReported(fixture, 'Final');

    expect(displayNames(fixture.upserts)).toEqual(['Final']);
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

type WatcherFixture = {
  directory: string;
  upserts: GatewayConfig[];
  watcher: GatewayConfigWatcher;
};

async function rewriteUntilReported(fixture: WatcherFixture, displayName: string): Promise<void> {
  for (let attempt = 0; attempt < 100 && fixture.upserts.length === 0; attempt += 1) {
    await saveGatewayConfig(fixture.directory, gateway(displayName));
    await delay(50);
  }
}

async function watcherFixture(): Promise<WatcherFixture> {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-gateway-watcher-fs-'));
  const upserts: GatewayConfig[] = [];

  temporaryDirectories.push(directory);
  await saveGatewayConfig(directory, gateway('Codex'));

  const watcher = new GatewayConfigWatcher({
    directory,
    debounceMs: 10,
    onUpsert: (config) => {
      upserts.push(config);
    },
    onRemove: () => undefined,
    onCorrupt: () => undefined,
  });

  openWatchers.push(watcher);

  return { directory, upserts, watcher };
}
