import type { PluginRegistryEntry, PluginSource } from '@recompose/contracts';

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  defaultPluginRegistryUrl,
  normalizePluginSources,
  parsePluginRegistryJson,
  pluginArtifacts,
  pluginManifestFrom,
  pluginSourceId,
  pluginUpdateAvailable,
  selectPluginArtifact,
  verifyPluginArtifact,
} from './plugin-store';

const checksum = '0123456789abcdef'.repeat(4);

describe('plugin registry JSON', () => {
  it('should parse a normalized registry', () => {
    const registry = parsePluginRegistryJson(
      JSON.stringify({ schema_version: 1, plugins: [plugin()] }),
    );

    expect(registry.plugins[0]?.id).toBe('sample-provider');
  });
});

describe('plugin sources', () => {
  it('should prepend official and deduplicate third-party sources', () => {
    const community = 'https://community.example/registry.json';
    const sources = normalizePluginSources([defaultPluginRegistryUrl, ` ${community} `, community]);

    expect(sources).toEqual([
      { id: 'official', name: 'Official', url: defaultPluginRegistryUrl },
      { id: pluginSourceId(community), name: 'community.example', url: community },
    ]);
  });
});

describe('plugin artifacts', () => {
  it('should expose current and historical direct artifacts', () => {
    const entry = directPlugin();

    expect(pluginArtifacts(entry).map(({ url }) => url)).toEqual([
      'https://downloads.example/current.zip',
      'https://downloads.example/old.zip',
    ]);
  });

  it('should select the exact normalized platform', () => {
    const entry = directPlugin();

    expect(selectPluginArtifact(entry.install, 'linux', 'amd64')?.url).toContain('current.zip');
    expect(selectPluginArtifact(entry.install, 'darwin', 'arm64')).toBeNull();
  });

  it('should verify SHA-256 bytes', () => {
    const data = new TextEncoder().encode('artifact-data');
    const selected = currentArtifact(directPlugin());
    const artifact = {
      ...selected,
      sha256: createHash('sha256').update(data).digest('hex'),
    };

    expect(verifyPluginArtifact(artifact, data)).toBe(true);
    expect(verifyPluginArtifact(artifact, new TextEncoder().encode('tampered'))).toBe(false);
  });
});

describe('pluginUpdateAvailable', () => {
  it('should compare numeric versions without downgrading', () => {
    expect(pluginUpdateAvailable('1.9.0', '1.10.0')).toBe(true);
    expect(pluginUpdateAvailable('2.0.0', '1.10.0')).toBe(false);
    expect(pluginUpdateAvailable('v1.0.0', '1.0.0')).toBe(false);
    expect(pluginUpdateAvailable('dev-a', 'dev-b')).toBe(true);
  });
});

describe('pluginManifestFrom', () => {
  it('should build a pinned GitHub release manifest', () => {
    expect(pluginManifestFrom(source(), plugin())).toMatchObject({
      schema_version: 1,
      id: 'sample-provider',
      version: '0.1.0',
      release_tag: 'v0.1.0',
      install: { type: 'github-release' },
    });
  });

  it('should build a pinned historical direct manifest', () => {
    expect(pluginManifestFrom(source(), directPlugin(), '0.1.0')).toMatchObject({
      schema_version: 2,
      version: '0.1.0',
      release_tag: '',
      install: { type: 'direct', artifacts: [{ url: 'https://downloads.example/old.zip' }] },
    });
  });

  it('should reject an unavailable version', () => {
    expect(() => pluginManifestFrom(source(), directPlugin(), '9.0.0')).toThrow(
      'plugin version 9.0.0 is unavailable',
    );
  });
});

// Helpers

function source(): PluginSource {
  return { id: 'official', name: 'Official', url: defaultPluginRegistryUrl };
}

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

function directPlugin(): PluginRegistryEntry {
  return {
    ...plugin(),
    version: '0.2.0',
    install: {
      type: 'direct',
      artifacts: [artifact('https://downloads.example/current.zip')],
    },
    versions: [
      {
        version: '0.1.0',
        install: {
          type: 'direct',
          artifacts: [artifact('https://downloads.example/old.zip')],
        },
      },
    ],
  };
}

function artifact(url: string) {
  return { goos: 'linux', goarch: 'amd64', url, sha256: checksum };
}

function currentArtifact(plugin: PluginRegistryEntry) {
  if (plugin.install.type !== 'direct') throw new Error('test plugin is not direct');

  const selected = plugin.install.artifacts[0];

  if (selected === undefined) throw new Error('test plugin has no artifact');

  return selected;
}
