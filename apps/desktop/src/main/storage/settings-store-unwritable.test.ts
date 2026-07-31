import { defaultSettings } from '@recompose/contracts';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { loadSettingsFile } from './settings-store';

vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();

  return {
    ...real,
    writeFile: async (...args: Parameters<typeof real.writeFile>) =>
      typeof args[0] === 'string' && args[0].includes('.tmp-')
        ? Promise.reject(new Error('the disk refused the write'))
        : real.writeFile(...args),
  };
});

const storedUnderVersionTwo = {
  schemaVersion: 2,
  theme: 'dark',
  launchAtLogin: false,
  showInMenuBar: true,
  enginePort: 8397,
  requireGatewayToken: true,
};

describe('a settings document the disk refuses to take back', () => {
  test('the migrated document still loads, because a failed write is not damage', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-settings-')), 'settings.json');

    await writeFile(file, JSON.stringify(storedUnderVersionTwo), 'utf8');
    const quarantined: string[] = [];

    const settings = await loadSettingsFile(file, (path) => {
      quarantined.push(path);
    });

    expect(settings).toEqual({
      ...defaultSettings(),
      theme: 'dark',
      launchAtLogin: false,
      showInMenuBar: true,
    });
    expect(quarantined).toEqual([]);
  });

  test('the document stays where it was, so the next launch reads it again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-settings-')), 'settings.json');

    await writeFile(file, JSON.stringify(storedUnderVersionTwo), 'utf8');

    await loadSettingsFile(file, () => undefined);

    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(storedUnderVersionTwo);
  });

  test('the refused write is written down rather than passed over in silence', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-settings-')), 'settings.json');

    await writeFile(file, JSON.stringify(storedUnderVersionTwo), 'utf8');

    await loadSettingsFile(file, () => undefined);

    expect(complaint.mock.calls.flat().map(String).join(' ')).toContain('settings');
  });
});
