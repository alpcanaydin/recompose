import type { PluginRegistryEntry } from '@recompose/contracts';

import { strToU8, zipSync } from 'fflate';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { pluginLibraryExtension } from './plugin-archive';
import { discoverInstalledPlugins, installPluginArchive } from './plugin-install';

const temporaryDirectories: string[] = [];

const platformSpellings = [
  { operatingSystem: 'macOS', architecture: 'x86_64', directory: join('darwin', 'amd64') },
  { operatingSystem: 'osx', architecture: 'aarch64', directory: join('darwin', 'arm64') },
  { operatingSystem: 'Darwin', architecture: 'x64', directory: join('darwin', 'amd64') },
];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe('platform spellings on the install path', () => {
  it.each(platformSpellings)(
    'should file a $operatingSystem $architecture build under $directory',
    async ({ operatingSystem, architecture, directory }) => {
      const root = await temporaryDirectory();

      const result = await installPluginArchive(
        archive('sample-provider.dylib', 'library'),
        plugin(),
        { pluginsDirectory: root, operatingSystem, architecture },
      );

      expect(result.path).toBe(join(root, directory, 'sample-provider-v0.1.0.dylib'));
    },
  );

  it('should install and discover on the running platform when none is named', async () => {
    const root = await temporaryDirectory();
    const extension = pluginLibraryExtension(process.platform);

    const result = await installPluginArchive(
      archive(`sample-provider${extension}`, 'library'),
      plugin(),
      { pluginsDirectory: root },
    );

    await expect(readFile(result.path, 'utf8')).resolves.toBe('library');
    await expect(discoverInstalledPlugins(root)).resolves.toEqual([
      { id: 'sample-provider', version: '0.1.0', path: result.path },
    ]);
  });
});

describe('install refusals', () => {
  it('should refuse a version that does not begin with a digit', async () => {
    const root = await temporaryDirectory();

    await expect(
      installPluginArchive(archive('sample-provider.dylib', 'library'), plugin('v1.0.0'), {
        pluginsDirectory: root,
        operatingSystem: 'darwin',
        architecture: 'arm64',
      }),
    ).rejects.toThrow('invalid plugin version v1.0.0');
  });

  it('should surface a read failure other than a missing target', async () => {
    const root = await temporaryDirectory();

    await mkdir(join(root, 'darwin', 'arm64', 'sample-provider-v0.1.0.dylib'), { recursive: true });

    await expect(installedInto(root, 'library')).rejects.toThrow();
  });

  it('should surface a write failure when the target stops being a file', async () => {
    const root = await temporaryDirectory();
    const path = await installedFixture(root, 'old');

    await expect(
      installPluginArchive(archive('sample-provider.dylib', 'new'), plugin(), {
        pluginsDirectory: root,
        operatingSystem: 'darwin',
        architecture: 'arm64',
        beforeWrite: async () => {
          await rm(path);
          await mkdir(path);
        },
      }),
    ).rejects.toThrow();
  });
});

describe('replacing an installed library', () => {
  it('should replace a library whose byte length changed', async () => {
    const root = await temporaryDirectory();
    const path = await installedFixture(root, 'old');

    const result = await installedInto(root, 'a considerably longer library');

    expect(result).toMatchObject({ overwritten: true, skipped: false });
    await expect(readFile(path, 'utf8')).resolves.toBe('a considerably longer library');
  });
});

describe('discovering installed libraries', () => {
  it('should ignore a library whose filename is not a plugin id', async () => {
    const root = await temporaryDirectory();

    await writeFile(join(root, '_scratch.so'), 'ignored');

    await expect(discoverInstalledPlugins(root, 'linux', 'amd64')).resolves.toEqual([]);
  });
});

// Helpers

function plugin(version = '0.1.0'): PluginRegistryEntry {
  return {
    id: 'sample-provider',
    name: 'Sample Provider',
    description: 'Adds sample provider support.',
    author: 'author-name',
    version,
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
  const root = await mkdtemp(join(tmpdir(), 'recompose-plugin-install-coverage-'));

  temporaryDirectories.push(root);

  return root;
}

async function installedFixture(root: string, content: string): Promise<string> {
  const path = join(root, 'darwin', 'arm64', 'sample-provider-v0.1.0.dylib');

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);

  return path;
}

async function installedInto(root: string, content: string) {
  const installed = await installPluginArchive(
    archive('sample-provider.dylib', content),
    plugin(),
    { pluginsDirectory: root, operatingSystem: 'darwin', architecture: 'arm64' },
  );

  return installed;
}
