import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import type { ProviderObservation } from './provider-observability';

import { configuredProviderLogStore, persistProviderObservations } from './provider-log-runtime';
import { ProviderLogStore } from './provider-log-store';
import { providerObservability } from './provider-observability';

const VARIABLE = 'RECOMPOSE_LOG_DIR';

function observation(model: string): ProviderObservation {
  return {
    provider: 'anthropic',
    model,
    dialect: 'anthropic',
    method: 'POST',
    startedAt: 1_700_000_000_000,
    durationMs: 12,
    ttftMs: 3,
    status: 200,
    usage: {
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    },
    generate: true,
  };
}

afterEach(() => {
  delete process.env[VARIABLE];
});

describe('choosing the log store the provider log directory names', () => {
  test('no configured directory means the gateway keeps no provider log', () => {
    delete process.env[VARIABLE];

    expect(configuredProviderLogStore()).toBeNull();
  });

  test('a blank directory means the gateway keeps no provider log', () => {
    process.env[VARIABLE] = '   ';

    expect(configuredProviderLogStore()).toBeNull();
  });

  test('one directory yields one store however often it is asked for', async () => {
    process.env[VARIABLE] = await mkdtemp(join(tmpdir(), 'recompose-log-'));

    const first = configuredProviderLogStore();

    expect(first).not.toBeNull();
    expect(configuredProviderLogStore()).toBe(first);
  });

  test('pointing the log elsewhere yields a different store', async () => {
    process.env[VARIABLE] = await mkdtemp(join(tmpdir(), 'recompose-log-'));

    const first = configuredProviderLogStore();

    process.env[VARIABLE] = await mkdtemp(join(tmpdir(), 'recompose-log-'));

    expect(configuredProviderLogStore()).not.toBe(first);
  });
});

describe('persisting what the provider observability bus reports', () => {
  test('installing a store twice still records one line per observation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'recompose-log-'));
    const store = new ProviderLogStore(directory);

    persistProviderObservations(store);
    persistProviderObservations(store);
    providerObservability().publish(observation('claude-sonnet-4-6'));
    await store.flush();

    const written = await readFile(join(directory, 'main.log'), 'utf8');

    expect(written.split('\n').filter((line) => line.includes('claude-sonnet-4-6'))).toHaveLength(
      1,
    );
  });
});
