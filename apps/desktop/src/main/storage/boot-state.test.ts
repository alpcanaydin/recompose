import { defaultSettings, GATEWAY_CONFIG_VERSION, type GatewayConfig } from '@recompose/contracts';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { storedBootState } from './boot-state';

const codex: GatewayConfig = {
  schemaVersion: GATEWAY_CONFIG_VERSION,
  slug: 'codex',
  displayName: 'Codex',
  port: 8397,
  virtualModels: [],
  layout: { nodes: {} },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('what recompose knows at boot', () => {
  test('a fresh machine boots with default settings and no gateway slugs', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-boot-'));

    await expect(storedBootState(userDataPath, () => undefined)).resolves.toEqual({
      settings: defaultSettings(),
      slugs: [],
    });
  });

  test('every stored gateway hands its slug to the boot state', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-boot-slugs-'));
    const gatewaysDir = join(userDataPath, 'gateways');

    await mkdir(gatewaysDir, { recursive: true });
    await writeFile(join(gatewaysDir, 'codex.json'), JSON.stringify(codex), 'utf8');

    await expect(storedBootState(userDataPath, () => undefined)).resolves.toMatchObject({
      slugs: ['codex'],
    });
  });

  test('a machine whose storage will not initialize still boots on defaults', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const blockingDir = await mkdtemp(join(tmpdir(), 'recompose-boot-blocked-'));
    const blockingPath = join(blockingDir, 'not-a-directory');

    await writeFile(blockingPath, '', 'utf8');

    await expect(storedBootState(blockingPath, () => undefined)).resolves.toEqual({
      settings: defaultSettings(),
      slugs: [],
    });
  });

  test('the refusal to initialize is written down rather than swallowed', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const blockingDir = await mkdtemp(join(tmpdir(), 'recompose-boot-noisy-'));
    const blockingPath = join(blockingDir, 'not-a-directory');

    await writeFile(blockingPath, '', 'utf8');
    await storedBootState(blockingPath, () => undefined);

    expect(complaint.mock.calls.flat().map(String).join(' ')).toContain('storage');
  });
});
