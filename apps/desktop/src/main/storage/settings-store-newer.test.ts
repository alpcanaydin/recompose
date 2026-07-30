import { defaultSettings, SETTINGS_VERSION } from '@recompose/contracts';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { initializeStorage } from './initialize-storage';
import { loadSettingsFile, SettingsNewerSchemaError } from './settings-store';

async function documentFrom(schemaVersion: number): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'recompose-newer-'));
  const file = join(dir, 'settings.json');

  await writeFile(file, JSON.stringify({ schemaVersion, theme: 'dark', whatever: true }), 'utf8');

  return { dir, file };
}

describe('a settings document written by a newer build', () => {
  test('reading it names the version rather than calling the file corrupt', async () => {
    const { file } = await documentFrom(SETTINGS_VERSION + 1);

    await expect(loadSettingsFile(file, () => undefined)).rejects.toThrow(SettingsNewerSchemaError);
  });

  test('the document stays where it is, so an older build never moves it aside', async () => {
    const { dir, file } = await documentFrom(SETTINGS_VERSION + 1);
    const quarantined: string[] = [];

    await loadSettingsFile(file, (path) => {
      quarantined.push(path);
    }).catch(() => undefined);

    expect(quarantined).toEqual([]);
    expect(await readdir(dir)).toEqual(['settings.json']);
  });

  test('the failure carries the version the document names', async () => {
    const { file } = await documentFrom(SETTINGS_VERSION + 3);

    await expect(loadSettingsFile(file, () => undefined)).rejects.toMatchObject({
      schemaVersion: SETTINGS_VERSION + 3,
    });
  });

  test('a document at the supported version still reads', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'recompose-current-'));
    const file = join(dir, 'settings.json');

    await writeFile(file, JSON.stringify({ ...defaultSettings(), theme: 'dark' }), 'utf8');

    await expect(loadSettingsFile(file, () => undefined)).resolves.toMatchObject({ theme: 'dark' });
  });

  test('a document that is genuinely corrupt is still quarantined', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'recompose-corrupt-'));
    const file = join(dir, 'settings.json');

    await writeFile(file, JSON.stringify({ schemaVersion: 1, theme: 'ultraviolet' }), 'utf8');

    const quarantined: string[] = [];

    await loadSettingsFile(file, (path) => {
      quarantined.push(path);
    });

    expect(quarantined).toHaveLength(1);
  });
});

describe('the boot read of a settings document from a newer build', () => {
  test('the failure reaches the caller rather than becoming a silent default', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'recompose-boot-'));

    await writeFile(
      join(dir, 'settings.json'),
      JSON.stringify({ schemaVersion: SETTINGS_VERSION + 1, theme: 'dark' }),
      'utf8',
    );

    await expect(initializeStorage(dir, () => undefined)).rejects.toThrow(SettingsNewerSchemaError);
  });
});
