import { describe, expect, it } from 'vitest';

import { parsePluginRegistry, pluginManifestSchema } from './plugin-store';

const checksum = '0123456789abcdef'.repeat(4);

describe('parsePluginRegistry normalization', () => {
  it('should normalize registry and platform fields', () => {
    const registry = parsePluginRegistry({
      schema_version: 2,
      plugins: [
        {
          id: ' sample-provider ',
          name: ' Sample Provider ',
          description: ' Adds sample provider support. ',
          author: ' author-name ',
          version: ' 0.2.0 ',
          tags: [' provider '],
          install: {
            type: 'direct',
            artifacts: [
              {
                goos: 'macos',
                goarch: 'aarch64',
                url: 'https://downloads.example/plugin.zip',
                sha256: checksum,
              },
            ],
          },
        },
      ],
    });

    expect(registry.plugins[0]).toMatchObject({
      id: 'sample-provider',
      name: 'Sample Provider',
      tags: ['provider'],
      install: {
        artifacts: [{ goos: 'darwin', goarch: 'arm64' }],
      },
    });
  });
});

describe('parsePluginRegistry identity validation', () => {
  it('should reject duplicate and unsafe plugin identities', () => {
    const plugin = registryPlugin();

    expect(() => parsePluginRegistry({ schema_version: 1, plugins: [plugin, plugin] })).toThrow(
      'duplicate plugin id',
    );
    expect(() =>
      parsePluginRegistry({ schema_version: 1, plugins: [{ ...plugin, id: '../plugin' }] }),
    ).toThrow();
    expect(() =>
      parsePluginRegistry({
        schema_version: 1,
        plugins: [{ ...plugin, repository: 'https://example.com/owner/repo' }],
      }),
    ).toThrow('repository must be a GitHub repository URL');
  });
});

describe('direct plugin registry validation', () => {
  it('should require schema version two', () => {
    const plugin = { ...registryPlugin(), install: directInstall() };

    expect(() => parsePluginRegistry({ schema_version: 1, plugins: [plugin] })).toThrow(
      'direct install requires schema_version 2',
    );
  });

  it('should reject artifact credentials, query parameters, and invalid checksums', () => {
    for (const artifact of [
      { ...directArtifact(), url: 'https://user:secret@downloads.example/plugin.zip' },
      { ...directArtifact(), url: 'https://downloads.example/plugin.zip?token=secret' },
      { ...directArtifact(), sha256: 'not-a-checksum' },
    ]) {
      expect(() =>
        parsePluginRegistry({
          schema_version: 2,
          plugins: [{ ...registryPlugin(), install: { type: 'direct', artifacts: [artifact] } }],
        }),
      ).toThrow();
    }
  });
});

describe('pluginManifestSchema', () => {
  it('should require a pinned release tag matching the version', () => {
    const manifest = {
      schema_version: 1,
      ...registryPlugin(),
      source_id: 'official',
      source_name: 'Official',
      source_url: 'https://plugins.example/registry.json',
      install: { type: 'github-release' },
    };

    expect(() => pluginManifestSchema.parse({ ...manifest, release_tag: '' })).toThrow(
      'release tag is required',
    );
    expect(() => pluginManifestSchema.parse({ ...manifest, release_tag: 'v2.0.0' })).toThrow(
      'release tag version mismatch',
    );
    expect(pluginManifestSchema.parse({ ...manifest, release_tag: 'v0.1.0' })).toMatchObject({
      version: '0.1.0',
      release_tag: 'v0.1.0',
    });
  });
});

// Helpers

function registryPlugin() {
  return {
    id: 'sample-provider',
    name: 'Sample Provider',
    description: 'Adds sample provider support.',
    author: 'author-name',
    version: '0.1.0',
    repository: 'https://github.com/author-name/sample-provider',
  };
}

function directArtifact() {
  return {
    goos: 'linux',
    goarch: 'amd64',
    url: 'https://downloads.example/plugin.zip',
    sha256: checksum,
  };
}

function directInstall() {
  return { type: 'direct', artifacts: [directArtifact()] };
}
