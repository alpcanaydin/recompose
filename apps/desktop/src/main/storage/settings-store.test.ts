import { defaultSettings } from '@recompose/contracts';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { loadSettingsFile, saveSettingsFile } from './settings-store';

describe('settings store', () => {
  test('absent file yields defaults', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-settings-')), 'settings.json');

    expect(await loadSettingsFile(file, () => undefined)).toEqual(defaultSettings());
  });

  test('saved settings load back identically', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-settings-')), 'settings.json');
    const custom = { ...defaultSettings(), theme: 'dark' as const, launchAtLogin: true };

    await saveSettingsFile(file, custom);

    expect(await loadSettingsFile(file, () => undefined)).toEqual(custom);
  });

  test('schema-invalid settings are quarantined and defaults are returned', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'recompose-settings-'));
    const file = join(dir, 'settings.json');

    await writeFile(
      file,
      JSON.stringify({ schemaVersion: 1, theme: 'neon', enginePort: 8397 }),
      'utf8',
    );
    const seen: string[] = [];

    const settings = await loadSettingsFile(file, (p) => {
      seen.push(p);
    });

    expect(settings).toEqual(defaultSettings());
    expect(seen).toHaveLength(1);
    const entries = await readdir(dir);

    expect(entries).toEqual([expect.stringMatching(/^settings\.json\.corrupt-/)]);
  });
});

describe('a settings document this build already reads', () => {
  test('a document that needs no carrying forward is left exactly as it lies', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-settings-')), 'settings.json');
    const asStored = JSON.stringify(defaultSettings());

    await writeFile(file, asStored, 'utf8');

    await loadSettingsFile(file, () => undefined);

    expect(await readFile(file, 'utf8')).toBe(asStored);
  });

  test('a document that migrated reaches the disk without waiting for the next save', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-settings-')), 'settings.json');

    await writeFile(
      file,
      JSON.stringify({
        schemaVersion: 2,
        theme: 'dark',
        launchAtLogin: false,
        showInMenuBar: true,
        enginePort: 8397,
        requireGatewayToken: true,
      }),
    );

    await loadSettingsFile(file, () => undefined);

    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      ...defaultSettings(),
      theme: 'dark',
      launchAtLogin: false,
      showInMenuBar: true,
    });
  });
});
