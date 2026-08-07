import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, grantsNothing, neverFetches } from './gateway-app.testkit';
import { ProviderLogStore } from './provider/provider-log-store';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { recursive: true })),
  );
});

describe('management logs', () => {
  it('should return the requested log tail and an incremental cursor', async () => {
    const fixture = await logsFixture([
      '[2026-06-15 10:00:00] first',
      '[2026-06-15 10:00:01] second',
      '[2026-06-15 10:00:02] third',
    ]);
    const app = gatewayWithLogs(fixture.store);

    const first = await app.request('http://127.0.0.1:8397/v0/management/logs?limit=2');
    const body = await responseObject(first);

    expect(body['lines']).toEqual(['[2026-06-15 10:00:01] second', '[2026-06-15 10:00:02] third']);
    expect(body['line-count']).toBe(2);
    expect(body['next-cursor']).not.toBe('');
  });

  it('should reject an invalid limit', async () => {
    const fixture = await logsFixture(['first']);
    const app = gatewayWithLogs(fixture.store);

    const answer = await app.request('http://127.0.0.1:8397/v0/management/logs?limit=0');

    expect(answer.status).toBe(400);
  });

  it('should truncate logs through the management delete route', async () => {
    const fixture = await logsFixture(['first']);
    const app = gatewayWithLogs(fixture.store);

    const deleted = await app.request('http://127.0.0.1:8397/v0/management/logs', {
      method: 'DELETE',
    });
    const read = await fixture.store.read();

    expect(deleted.status).toBe(200);
    expect(read.lines).toEqual([]);
  });

  it('should report disabled file logging without a configured store', async () => {
    const app = createGatewayApp(aGatewayHolding(), grantsNothing, neverFetches);

    const answer = await app.request('http://127.0.0.1:8397/v0/management/logs');

    expect(answer.status).toBe(400);
    await expect(answer.json()).resolves.toEqual({ error: 'logging to file disabled' });
  });
});

// Helpers

function gatewayWithLogs(store: ProviderLogStore) {
  return createGatewayApp(
    aGatewayHolding(),
    grantsNothing,
    neverFetches,
    undefined,
    undefined,
    store,
  );
}

async function logsFixture(lines: readonly string[]) {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-management-logs-'));

  temporaryDirectories.push(directory);
  await writeFile(join(directory, 'main.log'), `${lines.join('\n')}\n`, 'utf8');

  return { store: new ProviderLogStore(directory) };
}

async function responseObject(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json();

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('management logs response is not an object');
  }

  return Object.fromEntries(Object.entries(body));
}
