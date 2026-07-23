import { GATEWAY_CONFIG_VERSION, type GatewayConfig } from '@recompose/contracts';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { listGatewayConfigs, saveGatewayConfig } from './gateway-store';

const config: GatewayConfig = {
  schemaVersion: GATEWAY_CONFIG_VERSION,
  slug: 'personal',
  displayName: 'Personal',
  virtualModels: [
    {
      id: 'vm1',
      slug: 'fast',
      displayName: 'fast',
      routing: {
        kind: 'target',
        id: 't1',
        accountId: 'acc1',
        providerModel: 'claude-sonnet-5',
        weight: 100,
      },
    },
  ],
  layout: { nodes: {} },
};

async function freshDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'recompose-gateways-'));
}

describe('gateway store', () => {
  test('a saved gateway lists back identically, filed under its slug', async () => {
    const dir = await freshDir();

    await saveGatewayConfig(dir, config);

    expect(await readdir(dir)).toEqual(['personal.json']);
    expect(await listGatewayConfigs(dir, () => undefined)).toEqual([config]);
  });

  test('an empty directory lists no gateways', async () => {
    expect(await listGatewayConfigs(await freshDir(), () => undefined)).toEqual([]);
  });

  test('a corrupt gateway file is quarantined and the rest still load', async () => {
    const dir = await freshDir();

    await saveGatewayConfig(dir, config);
    await writeFile(join(dir, 'broken.json'), 'not json', 'utf8');
    const seen: string[] = [];

    const loaded = await listGatewayConfigs(dir, (p) => seen.push(p));

    expect(loaded).toEqual([config]);
    expect(seen).toHaveLength(1);
  });

  test('a schema-invalid gateway file is quarantined too', async () => {
    const dir = await freshDir();

    await writeFile(
      join(dir, 'bad.json'),
      JSON.stringify({ schemaVersion: 1, slug: 'X!' }),
      'utf8',
    );
    const seen: string[] = [];

    const loaded = await listGatewayConfigs(dir, (p) => seen.push(p));

    expect(loaded).toEqual([]);
    expect(seen).toHaveLength(1);
  });
});
