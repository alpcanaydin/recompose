import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { GatewayNewerSchemaError, listGatewayConfigs } from './gateway-store';

async function gatewaysHolding(schemaVersion: number): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'recompose-gateways-newer-'));

  await writeFile(
    join(dir, 'personal.json'),
    JSON.stringify({
      schemaVersion,
      slug: 'personal',
      displayName: 'Personal',
      whateverTheNewerBuildAdded: true,
    }),
    'utf8',
  );

  return dir;
}

describe('a gateway document written by a newer build', () => {
  test('listing names the version rather than calling the file corrupt', async () => {
    const dir = await gatewaysHolding(GATEWAY_CONFIG_VERSION + 1);

    await expect(listGatewayConfigs(dir, () => undefined)).rejects.toThrow(GatewayNewerSchemaError);
  });

  test('the document stays where it is, so an older build never moves it aside', async () => {
    const dir = await gatewaysHolding(GATEWAY_CONFIG_VERSION + 1);
    const quarantined: string[] = [];

    await listGatewayConfigs(dir, (path) => {
      quarantined.push(path);
    }).catch(() => undefined);

    expect(quarantined).toEqual([]);
    expect(await readdir(dir)).toEqual(['personal.json']);
  });

  test('the failure carries the version the document names', async () => {
    const dir = await gatewaysHolding(GATEWAY_CONFIG_VERSION + 4);

    const failure = await listGatewayConfigs(dir, () => undefined).catch((error: unknown) => error);

    expect(failure).toMatchObject({ schemaVersion: GATEWAY_CONFIG_VERSION + 4 });
    expect(String(failure)).toContain(String(GATEWAY_CONFIG_VERSION + 4));
  });
});
