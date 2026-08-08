import type { GatewayConfig } from '@recompose/contracts';

import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { gatewayConfigHash } from './gateway-config-hash';
import { GatewayConfigWatcher } from './gateway-config-watcher';
import { saveGatewayConfig } from './gateway-store';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { recursive: true })),
  );
});

describe('gatewayConfigHash', () => {
  it('should be deterministic and include ordered model routing', () => {
    const first = gateway('Codex', ['fast', 'slow']);
    const same = { ...first, layout: { nodes: {} } };
    const reordered = gateway('Codex', ['slow', 'fast']);

    expect(gatewayConfigHash(first)).toBe(gatewayConfigHash(same));
    expect(gatewayConfigHash(first)).not.toBe(gatewayConfigHash(reordered));
  });
});

describe('GatewayConfigWatcher semantic refresh', () => {
  it('should skip unchanged content and emit a semantic update once', async () => {
    const fixture = await watcherFixture(gateway('Codex', ['fast']));

    await fixture.watcher.prime();
    await saveGatewayConfig(fixture.directory, gateway('Codex', ['fast']));
    await fixture.watcher.refresh();
    await saveGatewayConfig(fixture.directory, gateway('Build', ['fast']));
    await fixture.watcher.refresh();
    await fixture.watcher.refresh();

    expect(fixture.upserts.map(({ displayName }) => displayName)).toEqual(['Build']);
  });

  it('should suppress the event for a write already served by IPC', async () => {
    const fixture = await watcherFixture(gateway('Codex', ['fast']));
    const updated = gateway('Build', ['fast']);

    await fixture.watcher.prime();
    fixture.watcher.noteWrite(updated);
    await saveGatewayConfig(fixture.directory, updated);
    await fixture.watcher.refresh();

    expect(fixture.upserts).toEqual([]);
  });

  it('should emit removal only for a previously known gateway', async () => {
    const fixture = await watcherFixture(gateway('Codex', ['fast']));

    await fixture.watcher.prime();
    await rm(join(fixture.directory, 'codex.json'));
    await fixture.watcher.refresh();
    await fixture.watcher.refresh();

    expect(fixture.removals).toEqual(['codex']);
  });
});

describe('GatewayConfigWatcher filesystem events', () => {
  it('should debounce repeated atomic-write events', async () => {
    vi.useFakeTimers();
    let notify: ((filename: string | null) => void) | undefined;
    const fixture = await watcherFixture(gateway('Codex', ['fast']), (listener) => {
      notify = listener;

      return { close: () => undefined };
    });

    await fixture.watcher.start();
    await saveGatewayConfig(fixture.directory, gateway('Build', ['fast']));
    notify?.('codex.json');
    notify?.('codex.json');
    await vi.advanceTimersByTimeAsync(75);
    await vi.waitFor(() => {
      expect(fixture.upserts).toHaveLength(1);
    });

    expect(fixture.upserts[0]?.displayName).toBe('Build');
    fixture.watcher.close();
  });
});

// Helpers

function gateway(displayName: string, modelIds: readonly string[]): GatewayConfig {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug: 'codex',
    displayName,
    port: 8397,
    virtualModels: modelIds.map((id) => ({
      id,
      displayName: id,
      target: { accountId: 'acc-key', providerModel: id },
    })),
    layout: { nodes: {} },
  };
}

type TestWatchFactory = (listener: (filename: string | null) => void) => { close: () => void };

async function watcherFixture(config: GatewayConfig, factory?: TestWatchFactory) {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-gateway-watcher-'));
  const upserts: GatewayConfig[] = [];
  const removals: string[] = [];

  temporaryDirectories.push(directory);
  await saveGatewayConfig(directory, config);

  const watcher = new GatewayConfigWatcher({
    directory,
    onUpsert: (next) => {
      upserts.push(next);
    },
    onRemove: (slug) => {
      removals.push(slug);
    },
    onCorrupt: () => undefined,
    ...(factory === undefined
      ? {}
      : { watchDirectory: (_directory, _signal, events) => factory(events.change) }),
  });

  return { directory, upserts, removals, watcher };
}
