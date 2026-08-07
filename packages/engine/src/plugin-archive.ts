import { unzipSync } from 'fflate';
import { posix } from 'node:path';

type ZipEntry = {
  name: string;
  originalSize: number;
  compression: number;
  encrypted: boolean;
  directory: boolean;
  regular: boolean;
};

const centralSignature = 0x02014b50;
const endSignature = 0x06054b50;
const maxEntries = 4096;
const maxEntryBytes = 256 * 1024 * 1024;
const maxArchiveBytes = 512 * 1024 * 1024;

function endOffset(data: Uint8Array): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const first = Math.max(0, data.byteLength - 65_557);

  for (let offset = data.byteLength - 22; offset >= first; offset -= 1) {
    if (view.getUint32(offset, true) === endSignature) return offset;
  }

  throw new Error('zip end record is missing');
}

function centralDirectory(data: Uint8Array): { count: number; offset: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const end = endOffset(data);
  const count = view.getUint16(end + 10, true);
  const offset = view.getUint32(end + 16, true);

  if (count > maxEntries) throw new Error('zip contains too many entries');
  if (offset >= data.byteLength) throw new Error('zip central directory is invalid');

  return { count, offset };
}

function unixFileType(versionMadeBy: number, externalAttributes: number): number {
  const operatingSystem = versionMadeBy >>> 8;

  return operatingSystem === 3 ? (externalAttributes >>> 16) & 0o170000 : 0;
}

function entryKind(name: string, fileType: number): { directory: boolean; regular: boolean } {
  const directory = name.endsWith('/') || fileType === 0o040000;

  return {
    directory,
    regular: fileType === 0 || fileType === 0o100000 || directory,
  };
}

function entryAt(data: Uint8Array, offset: number): { entry: ZipEntry; next: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  if (view.getUint32(offset, true) !== centralSignature) {
    throw new Error('zip central directory entry is invalid');
  }

  const flags = view.getUint16(offset + 8, true);
  const compression = view.getUint16(offset + 10, true);
  const originalSize = view.getUint32(offset + 24, true);
  const nameLength = view.getUint16(offset + 28, true);
  const extraLength = view.getUint16(offset + 30, true);
  const commentLength = view.getUint16(offset + 32, true);
  const versionMadeBy = view.getUint16(offset + 4, true);
  const externalAttributes = view.getUint32(offset + 38, true);
  const nameStart = offset + 46;
  const next = nameStart + nameLength + extraLength + commentLength;

  if (next > data.byteLength) throw new Error('zip central directory entry exceeds archive');

  const name = new TextDecoder().decode(data.subarray(nameStart, nameStart + nameLength));
  const fileType = unixFileType(versionMadeBy, externalAttributes);
  const kind = entryKind(name, fileType);

  return {
    entry: {
      name,
      originalSize,
      compression,
      encrypted: (flags & 1) !== 0,
      ...kind,
    },
    next,
  };
}

function cleanEntryName(name: string): string {
  rejectUnsafeZipName(name);

  const cleaned = posix.normalize(name);

  if (outsideArchive(cleaned)) throw new Error(`zip entry ${name} escapes archive root`);

  return cleaned;
}

function rejectUnsafeZipName(name: string): void {
  if (name.trim() === '') throw new Error('zip entry has empty name');
  if (name.includes('\\')) throw new Error(`zip entry ${name} uses backslash path separators`);
  if (name.startsWith('/')) throw new Error(`zip entry ${name} is absolute`);
}

function outsideArchive(name: string): boolean {
  return name === '.' || name === '..' || name.startsWith('../');
}

function validateArchiveEntry(entry: ZipEntry, names: Set<string>): void {
  validateArchiveIdentity(entry, names);
  validateArchiveFormat(entry);
}

function validateArchiveIdentity(entry: ZipEntry, names: Set<string>): void {
  if (names.has(entry.name)) throw new Error(`zip contains duplicate entry ${entry.name}`);
  if (entry.encrypted) throw new Error(`zip entry ${entry.name} is encrypted`);
}

function validateArchiveFormat(entry: ZipEntry): void {
  if (![0, 8].includes(entry.compression)) {
    throw new Error(`zip entry ${entry.name} uses unsupported compression`);
  }

  if (!entry.regular) throw new Error(`zip entry ${entry.name} is not a regular file`);

  if (entry.originalSize > maxEntryBytes) {
    throw new Error(`zip entry ${entry.name} is too large`);
  }
}

function archiveEntries(data: Uint8Array): ZipEntry[] {
  const central = centralDirectory(data);
  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let offset = central.offset;
  let totalSize = 0;

  for (let index = 0; index < central.count; index += 1) {
    const parsed = entryAt(data, offset);
    const name = cleanEntryName(parsed.entry.name);
    const entry = { ...parsed.entry, name };

    validateArchiveEntry(entry, names);

    names.add(name);
    entries.push(entry);
    totalSize += entry.originalSize;
    offset = parsed.next;
  }

  if (totalSize > maxArchiveBytes) throw new Error('zip expands beyond the archive size limit');

  return entries;
}

function pluginExtension(operatingSystem: string): string {
  if (operatingSystem === 'darwin') return '.dylib';
  if (operatingSystem === 'windows') return '.dll';

  return '.so';
}

function dynamicLibrary(name: string): boolean {
  const lower = name.toLowerCase();

  return lower.endsWith('.dylib') || lower.endsWith('.so') || lower.endsWith('.dll');
}

function targetCandidate(entry: ZipEntry, names: readonly string[]): boolean {
  if (entry.directory || !dynamicLibrary(entry.name)) return false;
  if (names.includes(entry.name)) return true;

  if (names.includes(posix.basename(entry.name))) {
    throw new Error('target dynamic library must be at zip root');
  }

  throw new Error(`dynamic library filename must be ${names.join(' or ')}`);
}

function onlyTarget(targets: readonly ZipEntry[], expected: string): ZipEntry {
  if (targets.length === 0) throw new Error(`zip does not contain ${expected}`);
  if (targets.length > 1) throw new Error('zip contains multiple target dynamic libraries');

  const target = targets[0];

  if (target === undefined) throw new Error('zip target disappeared');

  return target;
}

function targetEntry(
  entries: readonly ZipEntry[],
  pluginId: string,
  version: string,
  operatingSystem: string,
): ZipEntry {
  const extension = pluginExtension(operatingSystem);
  const names = [`${pluginId}${extension}`, `${pluginId}-v${version}${extension}`];

  return onlyTarget(
    entries.filter((entry) => targetCandidate(entry, names)),
    names[0] ?? 'plugin',
  );
}

export function pluginLibraryFromArchive(
  archive: Uint8Array,
  pluginId: string,
  version: string,
  operatingSystem: string,
): Uint8Array {
  const target = targetEntry(archiveEntries(archive), pluginId, version, operatingSystem);
  const extracted = unzipSync(archive, {
    filter: (file) => file.name === target.name && file.originalSize <= maxEntryBytes,
  });
  const library = extracted[target.name];

  if (library === undefined) throw new Error('zip target could not be extracted');

  return library;
}

export function pluginLibraryExtension(operatingSystem: string): string {
  return pluginExtension(operatingSystem);
}
