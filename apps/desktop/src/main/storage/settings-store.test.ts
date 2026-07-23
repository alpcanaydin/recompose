import { defaultSettings } from '@recompose/contracts';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
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
    const custom = { ...defaultSettings(), theme: 'dark' as const, enginePort: 9001 };

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

    const settings = await loadSettingsFile(file, (p) => seen.push(p));

    expect(settings).toEqual(defaultSettings());
    expect(seen).toHaveLength(1);
    const entries = await readdir(dir);

    expect(entries).toEqual([expect.stringMatching(/^settings\.json\.corrupt-/)]);
  });
});
