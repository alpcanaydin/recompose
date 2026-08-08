import type { GatewayConfig } from '@recompose/contracts';

import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { GatewayConfigWatcher, type GatewayWatchEvents } from './gateway-config-watcher';
import { saveGatewayConfig } from './gateway-store';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe('GatewayConfigWatcher asked to start under a shutdown', () => {
  it('should install no watch when the shutdown has already happened', async () => {
    const fixture = await watcherFixture();

    await fixture.watcher.start(AbortSignal.abort());

    expect(fixture.events).toEqual([]);
  });

  it('should install no watch when the shutdown lands while the directory is read', async () => {
    const shutdown = new AbortController();
    const fixture = await watcherFixture(() => {
      shutdown.abort();
    });

    await writeFile(join(fixture.directory, 'broken.json'), 'not json at all', 'utf8');
    await fixture.watcher.start(shutdown.signal);

    expect(fixture.quarantined).toHaveLength(1);
    expect(fixture.events).toEqual([]);
  });
});

// Helpers

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

async function watcherFixture(whenQuarantined: () => void = () => undefined) {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-gateway-watcher-signal-'));
  const events: GatewayWatchEvents[] = [];
  const quarantined: string[] = [];

  temporaryDirectories.push(directory);
  await saveGatewayConfig(directory, gateway('Codex'));

  const watcher = new GatewayConfigWatcher({
    directory,
    onUpsert: () => undefined,
    onRemove: () => undefined,
    onCorrupt: (quarantinedPath) => {
      quarantined.push(quarantinedPath);
      whenQuarantined();
    },
    watchDirectory: (_directory, _signal, installed) => {
      events.push(installed);

      return { close: () => undefined };
    },
  });

  return { directory, events, quarantined, watcher };
}
