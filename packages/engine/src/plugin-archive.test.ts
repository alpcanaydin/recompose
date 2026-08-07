import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { pluginLibraryFromArchive } from './plugin-archive';

describe('pluginLibraryFromArchive', () => {
  it('should extract the unversioned platform library at the zip root', () => {
    const archive = zip({ 'sample-provider.dylib': 'library-data', 'README.md': 'ignored' });

    expect(
      new TextDecoder().decode(
        pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'darwin'),
      ),
    ).toBe('library-data');
  });

  it('should accept the versioned platform library', () => {
    const archive = zip({ 'sample-provider-v0.1.0.so': 'library-data' });

    expect(
      new TextDecoder().decode(
        pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'linux'),
      ),
    ).toBe('library-data');
  });
});

describe('plugin archive path safety', () => {
  it('should reject escaping, absolute, backslash, and nested target paths', () => {
    const cases = [
      zip({ '../sample-provider.dylib': 'library' }),
      zip({ '/sample-provider.dylib': 'library' }),
      zip({ 'nested\\sample-provider.dylib': 'library' }),
      zip({ 'nested/sample-provider.dylib': 'library' }),
    ];

    for (const archive of cases) {
      expect(() =>
        pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'darwin'),
      ).toThrow();
    }
  });

  it('should reject a wrong or second dynamic library', () => {
    expect(() =>
      pluginLibraryFromArchive(
        zip({ 'other.dylib': 'library' }),
        'sample-provider',
        '0.1.0',
        'darwin',
      ),
    ).toThrow('dynamic library filename');
    expect(() =>
      pluginLibraryFromArchive(
        zip({ 'sample-provider.dylib': 'one', 'sample-provider-v0.1.0.dylib': 'two' }),
        'sample-provider',
        '0.1.0',
        'darwin',
      ),
    ).toThrow('multiple target dynamic libraries');
  });

  it('should reject a Unix symlink entry', () => {
    const archive = markedAsSymlink(zip({ 'sample-provider.so': 'target' }));

    expect(() => pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'linux')).toThrow(
      'not a regular file',
    );
  });

  it('should reject encrypted and unsupported compression metadata', () => {
    const encrypted = changedCentral(zip({ 'sample-provider.so': 'target' }), 8, 1);
    const unsupported = changedCentral(zip({ 'sample-provider.so': 'target' }), 10, 14);

    expect(() => pluginLibraryFromArchive(encrypted, 'sample-provider', '0.1.0', 'linux')).toThrow(
      'encrypted',
    );
    expect(() =>
      pluginLibraryFromArchive(unsupported, 'sample-provider', '0.1.0', 'linux'),
    ).toThrow('unsupported compression');
  });
});

// Helpers

function zip(files: Record<string, string>): Uint8Array {
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])),
  );
}

function centralOffset(archive: Uint8Array): number {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

  for (let offset = 0; offset <= archive.byteLength - 4; offset += 1) {
    if (view.getUint32(offset, true) === 0x02014b50) return offset;
  }

  throw new Error('test zip has no central entry');
}

function changedCentral(archive: Uint8Array, fieldOffset: number, value: number): Uint8Array {
  const changed = archive.slice();
  const view = new DataView(changed.buffer, changed.byteOffset, changed.byteLength);

  view.setUint16(centralOffset(changed) + fieldOffset, value, true);

  return changed;
}

function markedAsSymlink(archive: Uint8Array): Uint8Array {
  const changed = archive.slice();
  const view = new DataView(changed.buffer, changed.byteOffset, changed.byteLength);
  const offset = centralOffset(changed);

  view.setUint16(offset + 4, (3 << 8) | 20, true);
  view.setUint32(offset + 38, (0o120777 << 16) >>> 0, true);

  return changed;
}
