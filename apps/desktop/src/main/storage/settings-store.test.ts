import { defaultSettings } from '@recompose/contracts';
import { mkdtemp } from 'node:fs/promises';
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
});
