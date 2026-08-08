import type { GatewayConfig } from '@recompose/contracts';

import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GatewayConfigWatcher,
  type GatewayWatchDirectory,
  type GatewayWatchEvents,
} from './gateway-config-watcher';
import { saveGatewayConfig } from './gateway-store';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe('GatewayConfigWatcher reload lifecycle parity', () => {
  it('TestTriggerServerUpdateCancelsPendingTimerOnImmediate', async () => {
    vi.useFakeTimers();
    const fixture = await watcherFixture();

    await fixture.watcher.start();
    await saveGatewayConfig(fixture.directory, gateway('Build'));

    fixture.events[0]?.change('codex.json');
    expect(vi.getTimerCount()).toBe(1);
    await fixture.watcher.refreshImmediately();
    await vi.advanceTimersByTimeAsync(100);

    expect(fixture.upserts.map((config) => config.displayName)).toEqual(['Build']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('TestProcessEventsHandlesEventErrorAndChannelClose', async () => {
    vi.useFakeTimers();
    const fixture = await watcherFixture();

    await fixture.watcher.start();
    fixture.events[0]?.change('codex.json');

    const failure = new Error('watcher error');

    fixture.events[0]?.error(failure);
    fixture.events[0]?.close();

    expect(fixture.errors).toEqual([failure]);
    expect(vi.getTimerCount()).toBe(0);
    await fixture.watcher.start();
    expect(fixture.events).toHaveLength(2);
  });

  it('TestNormalizeAuthPathAndDebounceCleanup', async () => {
    vi.useFakeTimers();
    const fixture = await watcherFixture();

    await fixture.watcher.start();
    await saveGatewayConfig(fixture.directory, gateway('Build'));

    fixture.events[0]?.change(' ./nested/../codex.json ');
    fixture.events[0]?.change(join(fixture.directory, 'codex.json'));
    fixture.events[0]?.change(join(fixture.directory, '..', 'outside.json'));
    fixture.events[0]?.change('notes.txt');

    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(75);
    await vi.waitFor(() => {
      expect(fixture.upserts).toHaveLength(1);
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('GatewayConfigWatcher cancellation lifecycle parity', () => {
  it('TestLoadFileClientsWalkError', async () => {
    const fixture = await watcherFixture();

    await fixture.watcher.prime();
    await rm(fixture.directory, { recursive: true });
    await writeFile(fixture.directory, 'not a directory');

    await expect(fixture.watcher.refresh()).rejects.toThrow();
    expect(fixture.removals).toEqual([]);

    await rm(fixture.directory);
    await mkdir(fixture.directory);
    await saveGatewayConfig(fixture.directory, gateway('Recovered'));
    await fixture.watcher.refresh();
    expect(fixture.upserts.map((config) => config.displayName)).toEqual(['Recovered']);
  });

  it('TestScheduleProcessEventsStopsOnContextDone', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fixture = await watcherFixture();

    await fixture.watcher.start(controller.signal);
    fixture.events[0]?.change('codex.json');

    controller.abort();
    fixture.events[0]?.change('codex.json');
    await vi.advanceTimersByTimeAsync(100);

    expect(fixture.closes).toHaveBeenCalledOnce();
    expect(fixture.upserts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

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
  const directory = await mkdtemp(join(tmpdir(), 'recompose-gateway-watcher-lifecycle-'));
  const events: GatewayWatchEvents[] = [];
  const errors: unknown[] = [];
  const removals: string[] = [];
  const upserts: GatewayConfig[] = [];
  const closes = vi.fn((): void => undefined);
  const watchDirectory: GatewayWatchDirectory = (_directory, _signal, nextEvents) => {
    events.push(nextEvents);

    return { close: closes };
  };

  temporaryDirectories.push(directory);
  await saveGatewayConfig(directory, gateway('Codex'));
  const watcher = new GatewayConfigWatcher({
    directory,
    onUpsert: (config) => {
      upserts.push(config);
    },
    onRemove: (slug) => {
      removals.push(slug);
    },
    onCorrupt: () => undefined,
    onError: (failure) => {
      errors.push(failure);
    },
    watchDirectory,
  });

  return { closes, directory, errors, events, removals, upserts, watcher };
}
