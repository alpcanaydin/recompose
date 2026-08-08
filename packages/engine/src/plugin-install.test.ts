import type { PluginRegistryEntry } from '@recompose/contracts';

import { strToU8, zipSync } from 'fflate';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  discoverInstalledPlugins,
  installPluginArchive,
  LoadedPluginLockedError,
} from './plugin-install';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { recursive: true })),
  );
});

describe('installPluginArchive', () => {
  it('should write the versioned platform library', async () => {
    const root = await temporaryDirectory();

    const result = await installPluginArchive(
      archive('sample-provider.dylib', 'library-data'),
      plugin(),
      {
        pluginsDirectory: root,
        operatingSystem: 'darwin',
        architecture: 'arm64',
      },
    );

    expect(result).toMatchObject({ overwritten: false, skipped: false });
    expect(result.path).toBe(join(root, 'darwin', 'arm64', 'sample-provider-v0.1.0.dylib'));
    await expect(readFile(result.path, 'utf8')).resolves.toBe('library-data');
  });

  it('should report overwrite and replace an existing library', async () => {
    const fixture = await installedFixture('darwin', 'arm64', 'old');

    const result = await installPluginArchive(archive('sample-provider.dylib', 'new'), plugin(), {
      pluginsDirectory: fixture.root,
      operatingSystem: 'darwin',
      architecture: 'arm64',
    });

    expect(result.overwritten).toBe(true);
    expect(result.skipped).toBe(false);
    await expect(readFile(fixture.path, 'utf8')).resolves.toBe('new');
  });
});

describe('loaded plugin overwrite rules', () => {
  it('should skip identical bytes before consulting the loaded Windows lock', async () => {
    const fixture = await installedFixture('windows', 'amd64', 'same');
    let prepared = false;

    const result = await installPluginArchive(archive('sample-provider.dll', 'same'), plugin(), {
      pluginsDirectory: fixture.root,
      operatingSystem: 'windows',
      architecture: 'amd64',
      pluginLoaded: () => true,
      beforeWrite: async () => {
        await Promise.resolve();
        prepared = true;
      },
    });

    expect(result).toMatchObject({ overwritten: true, skipped: true });
    expect(prepared).toBe(false);
  });

  it('should block a changed loaded Windows library without preparation', async () => {
    const fixture = await installedFixture('windows', 'amd64', 'old');

    await expect(
      installPluginArchive(archive('sample-provider.dll', 'new'), plugin(), {
        pluginsDirectory: fixture.root,
        operatingSystem: 'windows',
        architecture: 'amd64',
        pluginLoaded: () => true,
      }),
    ).rejects.toBeInstanceOf(LoadedPluginLockedError);
    await expect(readFile(fixture.path, 'utf8')).resolves.toBe('old');
  });

  it('should let beforeWrite unload the Windows plugin', async () => {
    const fixture = await installedFixture('windows', 'amd64', 'old');
    let loaded = true;

    const result = await installPluginArchive(archive('sample-provider.dll', 'new'), plugin(), {
      pluginsDirectory: fixture.root,
      operatingSystem: 'windows',
      architecture: 'amd64',
      pluginLoaded: () => loaded,
      beforeWrite: async () => {
        await Promise.resolve();
        loaded = false;
      },
    });

    expect(result.overwritten).toBe(true);
    await expect(readFile(fixture.path, 'utf8')).resolves.toBe('new');
  });
});

describe('discoverInstalledPlugins', () => {
  it('should prefer the platform directory and parse versioned filenames', async () => {
    const root = await temporaryDirectory();
    const platform = join(root, 'linux', 'amd64');

    await mkdir(platform, { recursive: true });
    await Promise.all([
      writeFile(join(platform, 'sample-provider-v1.2.3.so'), 'platform'),
      writeFile(join(root, 'sample-provider-v0.1.0.so'), 'fallback'),
      writeFile(join(root, 'other-provider.so'), 'other'),
      writeFile(join(root, 'ignored.dll'), 'wrong-platform'),
    ]);

    const discovered = await discoverInstalledPlugins(root, 'linux', 'amd64');

    expect(discovered).toEqual([
      {
        id: 'sample-provider',
        version: '1.2.3',
        path: join(platform, 'sample-provider-v1.2.3.so'),
      },
      { id: 'other-provider', version: '', path: join(root, 'other-provider.so') },
    ]);
  });
});

// Helpers

function plugin(): PluginRegistryEntry {
  return {
    id: 'sample-provider',
    name: 'Sample Provider',
    description: 'Adds sample provider support.',
    author: 'author-name',
    version: '0.1.0',
    versions: [],
    repository: 'https://github.com/author-name/sample-provider',
    logo: '',
    homepage: '',
    license: 'MIT',
    tags: ['provider'],
    install: { type: 'github-release' },
    auth_required: false,
  };
}

function archive(name: string, content: string): Uint8Array {
  return zipSync({ [name]: strToU8(content) });
}

async function temporaryDirectory(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'recompose-plugin-install-'));

  temporaryDirectories.push(root);

  return root;
}

async function installedFixture(operatingSystem: string, architecture: string, content: string) {
  const root = await temporaryDirectory();
  const extension = operatingSystem === 'windows' ? '.dll' : '.dylib';
  const path = join(root, operatingSystem, architecture, `sample-provider-v0.1.0${extension}`);

  await mkdir(join(root, operatingSystem, architecture), { recursive: true });
  await writeFile(path, content);

  return { root, path };
}
