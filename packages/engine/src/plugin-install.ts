import type { PluginRegistryEntry } from '@recompose/contracts';

import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { pluginLibraryExtension, pluginLibraryFromArchive } from './plugin-archive';

export type PluginInstallOptions = {
  pluginsDirectory: string;
  operatingSystem?: string | undefined;
  architecture?: string | undefined;
  pluginLoaded?: (() => boolean) | undefined;
  beforeWrite?: (() => Promise<void>) | undefined;
};

export type PluginInstallResult = {
  id: string;
  version: string;
  path: string;
  overwritten: boolean;
  skipped: boolean;
};

export type InstalledPlugin = { id: string; version: string; path: string };

export class LoadedPluginLockedError extends Error {
  public constructor() {
    super('loaded plugin library cannot be overwritten while the server is running');
    this.name = 'LoadedPluginLockedError';
  }
}

function normalizedOperatingSystem(value: string | undefined): string {
  const operatingSystem = (value ?? process.platform).trim().toLowerCase();

  return operatingSystem === 'macos' || operatingSystem === 'osx' ? 'darwin' : operatingSystem;
}

function normalizedArchitecture(value: string | undefined): string {
  const architecture = (value ?? process.arch).trim().toLowerCase();

  if (architecture === 'x64' || architecture === 'x86_64') return 'amd64';

  return architecture === 'aarch64' ? 'arm64' : architecture;
}

function pluginVersion(plugin: PluginRegistryEntry): string {
  if (!/^[0-9][0-9A-Za-z.+-]*$/u.test(plugin.version)) {
    throw new Error(`invalid plugin version ${plugin.version}`);
  }

  return plugin.version;
}

function targetPath(plugin: PluginRegistryEntry, options: PluginInstallOptions): string {
  const operatingSystem = normalizedOperatingSystem(options.operatingSystem);
  const architecture = normalizedArchitecture(options.architecture);
  const filename = `${plugin.id}-v${pluginVersion(plugin)}${pluginLibraryExtension(operatingSystem)}`;

  return join(options.pluginsDirectory, operatingSystem, architecture, filename);
}

async function existingBytes(path: string): Promise<Uint8Array | null> {
  try {
    return await readFile(path);
  } catch (failure) {
    if (missingFile(failure)) return null;

    throw failure;
  }
}

function missingFile(failure: unknown): boolean {
  return (
    typeof failure === 'object' && failure !== null && Reflect.get(failure, 'code') === 'ENOENT'
  );
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;

  return left.every((value, index) => value === right[index]);
}

function loadedWindowsPlugin(options: PluginInstallOptions): boolean {
  return (
    normalizedOperatingSystem(options.operatingSystem) === 'windows' &&
    options.pluginLoaded?.() === true
  );
}

async function prepareOverwrite(
  options: PluginInstallOptions,
  overwritten: boolean,
): Promise<void> {
  if (!overwritten) return;

  await options.beforeWrite?.();

  if (loadedWindowsPlugin(options)) throw new LoadedPluginLockedError();
}

async function writeAtomic(path: string, data: Uint8Array, operatingSystem: string): Promise<void> {
  const directory = dirname(path);
  const temporary = join(directory, `.${basename(path)}.tmp-${randomUUID()}`);

  await mkdir(directory, { recursive: true });

  try {
    await writeFile(temporary, data, { mode: operatingSystem === 'windows' ? 0o644 : 0o755 });
    if (operatingSystem !== 'windows') await chmod(temporary, 0o755);
    await replaceFile(temporary, path, operatingSystem);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function replaceFile(
  temporary: string,
  target: string,
  operatingSystem: string,
): Promise<void> {
  try {
    await rename(temporary, target);
  } catch (failure) {
    if (operatingSystem !== 'windows') throw failure;

    await rm(target, { force: true });
    await rename(temporary, target);
  }
}

export async function installPluginArchive(
  archive: Uint8Array,
  plugin: PluginRegistryEntry,
  options: PluginInstallOptions,
): Promise<PluginInstallResult> {
  const operatingSystem = normalizedOperatingSystem(options.operatingSystem);
  const path = targetPath(plugin, options);
  const library = pluginLibraryFromArchive(
    archive,
    plugin.id,
    pluginVersion(plugin),
    operatingSystem,
  );
  const existing = await existingBytes(path);
  const overwritten = existing !== null;

  if (existing !== null && sameBytes(existing, library)) {
    return { id: plugin.id, version: plugin.version, path, overwritten: true, skipped: true };
  }

  await prepareOverwrite(options, overwritten);
  await writeAtomic(path, library, operatingSystem);

  return { id: plugin.id, version: plugin.version, path, overwritten, skipped: false };
}

function pluginFile(path: string, extension: string): InstalledPlugin | null {
  const file = basename(path);

  if (!file.toLowerCase().endsWith(extension)) return null;

  const name = file.slice(0, -extension.length);
  const versionAt = name.lastIndexOf('-v');
  const id = versionAt > 0 ? name.slice(0, versionAt) : name;
  const version = versionAt > 0 ? name.slice(versionAt + 2) : '';

  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id) ? { id, version, path } : null;
}

async function pluginsIn(directory: string, extension: string): Promise<InstalledPlugin[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = entries.reduce<InstalledPlugin[]>((plugins, entry) => {
    const plugin = entry.isFile() ? pluginFile(join(directory, entry.name), extension) : null;

    if (plugin !== null) plugins.push(plugin);

    return plugins;
  }, []);

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function discoverInstalledPlugins(
  pluginsDirectory: string,
  operatingSystem: string = process.platform,
  architecture: string = process.arch,
): Promise<InstalledPlugin[]> {
  const os = normalizedOperatingSystem(operatingSystem);
  const arch = normalizedArchitecture(architecture);
  const extension = pluginLibraryExtension(os);
  const candidates = [join(pluginsDirectory, os, arch), pluginsDirectory];
  const discovered = (
    await Promise.all(candidates.map(async (directory) => pluginsIn(directory, extension)))
  ).flat();
  const seen = new Set<string>();

  return discovered.filter((plugin) => {
    if (seen.has(plugin.id)) return false;

    seen.add(plugin.id);

    return true;
  });
}
