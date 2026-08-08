import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { pluginLibraryExtension, pluginLibraryFromArchive } from './plugin-archive';

const centralSignature = 0x02014b50;
const endSignature = 0x06054b50;

function zip(files: Record<string, string>): Uint8Array {
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])),
  );
}

function viewOf(archive: Uint8Array): DataView {
  return new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
}

function firstCentralOffset(archive: Uint8Array): number {
  const view = viewOf(archive);

  for (let offset = 0; offset <= archive.byteLength - 4; offset += 1) {
    if (view.getUint32(offset, true) === centralSignature) return offset;
  }

  throw new Error('test zip has no central entry');
}

function endRecordOffset(archive: Uint8Array): number {
  const view = viewOf(archive);

  for (let offset = archive.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === endSignature) return offset;
  }

  throw new Error('test zip has no end record');
}

function centralOffsets(archive: Uint8Array): number[] {
  const view = viewOf(archive);
  const offsets: number[] = [];
  let offset = firstCentralOffset(archive);

  while (offset + 46 <= archive.byteLength && view.getUint32(offset, true) === centralSignature) {
    offsets.push(offset);
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }

  return offsets;
}

function withEveryEntrySize(archive: Uint8Array, size: number): Uint8Array {
  const changed = archive.slice();
  const view = viewOf(changed);

  for (const offset of centralOffsets(changed)) view.setUint32(offset + 24, size, true);

  return changed;
}

describe('Naming the platform plugin library', () => {
  it('should name the extension each operating system loads', () => {
    const extensions = ['darwin', 'windows', 'linux'].map((system) =>
      pluginLibraryExtension(system),
    );

    expect(extensions).toEqual(['.dylib', '.dll', '.so']);
  });

  it('should extract the Windows library from the archive', () => {
    const archive = zip({ 'sample-provider.dll': 'library-data' });
    const library = pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'windows');

    expect(new TextDecoder().decode(library)).toBe('library-data');
  });
});

describe('Selecting the plugin library from the archive', () => {
  it('should report an archive that carries no dynamic library', () => {
    expect(() =>
      pluginLibraryFromArchive(zip({ 'README.md': 'notes' }), 'sample-provider', '0.1.0', 'darwin'),
    ).toThrow('zip does not contain sample-provider.dylib');
  });

  it('should walk past a folder entry to reach the library', () => {
    const archive = zip({ 'docs/': '', 'sample-provider.dylib': 'library-data' });
    const library = pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'darwin');

    expect(new TextDecoder().decode(library)).toBe('library-data');
  });
});

describe('Rejecting an unsafe plugin archive entry name', () => {
  it('should reject two entries that normalize to the same name', () => {
    const archive = zip({ 'sample-provider.dylib': 'one', './sample-provider.dylib': 'two' });

    expect(() => pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'darwin')).toThrow(
      'duplicate entry',
    );
  });

  it('should reject an entry whose name is blank', () => {
    expect(() =>
      pluginLibraryFromArchive(zip({ ' ': 'nameless' }), 'sample-provider', '0.1.0', 'darwin'),
    ).toThrow('zip entry has empty name');
  });

  it('should reject an entry that names the archive root itself', () => {
    expect(() =>
      pluginLibraryFromArchive(zip({ '.': 'root' }), 'sample-provider', '0.1.0', 'darwin'),
    ).toThrow('escapes archive root');
  });
});

describe('Rejecting a malformed plugin archive', () => {
  it('should reject an archive whose end record was cut off', () => {
    const archive = zip({ 'sample-provider.dylib': 'library-data' });
    const truncated = archive.slice(0, archive.byteLength - 4);

    expect(() => pluginLibraryFromArchive(truncated, 'sample-provider', '0.1.0', 'darwin')).toThrow(
      'zip end record is missing',
    );
  });

  it('should reject an archive whose central directory entry is unrecognisable', () => {
    const archive = zip({ 'sample-provider.dylib': 'library-data' }).slice();

    viewOf(archive).setUint32(firstCentralOffset(archive), 0x01020304, true);

    expect(() => pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'darwin')).toThrow(
      'zip central directory entry is invalid',
    );
  });

  it('should reject an archive whose central directory sits past its end', () => {
    const archive = zip({ 'sample-provider.dylib': 'library-data' }).slice();

    viewOf(archive).setUint32(endRecordOffset(archive) + 16, 0xffffffff, true);

    expect(() => pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'darwin')).toThrow(
      'zip central directory is invalid',
    );
  });

  it('should reject an archive whose central directory entry runs past its end', () => {
    const archive = zip({ 'sample-provider.dylib': 'library-data' }).slice();

    viewOf(archive).setUint16(firstCentralOffset(archive) + 28, 60_000, true);

    expect(() => pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'darwin')).toThrow(
      'zip central directory entry exceeds archive',
    );
  });
});

describe('Rejecting an oversized plugin archive', () => {
  it('should reject an archive that declares more entries than it may hold', () => {
    const archive = zip({ 'sample-provider.dylib': 'library-data' }).slice();

    viewOf(archive).setUint16(endRecordOffset(archive) + 10, 5000, true);

    expect(() => pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'darwin')).toThrow(
      'zip contains too many entries',
    );
  });

  it('should reject an entry that expands past the per-entry ceiling', () => {
    const archive = withEveryEntrySize(
      zip({ 'sample-provider.dylib': 'library-data' }),
      0xffffffff,
    );

    expect(() => pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'darwin')).toThrow(
      'is too large',
    );
  });

  it('should reject an archive that expands past the whole-archive ceiling', () => {
    const archive = withEveryEntrySize(
      zip({ 'a.txt': 'one', 'b.txt': 'two', 'sample-provider.dylib': 'library-data' }),
      0x10000000,
    );

    expect(() => pluginLibraryFromArchive(archive, 'sample-provider', '0.1.0', 'darwin')).toThrow(
      'zip expands beyond the archive size limit',
    );
  });
});
