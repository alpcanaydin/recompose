import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { loadInstalledPluginHost } from './plugin-runtime';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { recursive: true, force: true })),
  );
});

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'recompose-plugin-runtime-'));

  temporaryDirectories.push(path);

  return path;
}

function libraryName(): string {
  if (process.platform === 'darwin') return 'broken-plugin-v1.0.0.dylib';

  return process.platform === 'win32' ? 'broken-plugin-v1.0.0.dll' : 'broken-plugin-v1.0.0.so';
}

function reportedFailures(): string[] {
  const reported: string[] = [];

  vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
    reported.push(parts.map((part) => String(part)).join(' '));
  });

  return reported;
}

describe('loading the installed plugin host', () => {
  test('an unset plugins directory yields a host holding nothing', async () => {
    const host = await loadInstalledPluginHost(undefined);

    expect(host.snapshot()).toStrictEqual([]);
  });

  test('a blank plugins directory yields a host holding nothing', async () => {
    const host = await loadInstalledPluginHost('   ');

    expect(host.snapshot()).toStrictEqual([]);
  });

  test('a plugins directory holding no libraries yields a host holding nothing', async () => {
    const directory = await temporaryDirectory();
    const host = await loadInstalledPluginHost(directory);

    expect(host.snapshot()).toStrictEqual([]);
  });

  test('a library that will not load is reported by name and leaves the host serving', async () => {
    const directory = await temporaryDirectory();

    await writeFile(join(directory, libraryName()), 'not a shared library');

    const reported = reportedFailures();
    const host = await loadInstalledPluginHost(directory);

    expect(host.registered('broken-plugin')).toBe(false);
    expect(reported.join('\n')).toContain('recompose could not load plugin "broken-plugin"');
  });
});
