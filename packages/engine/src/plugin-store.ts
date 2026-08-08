import type {
  PluginArtifact,
  PluginInstallPlan,
  PluginManifest,
  PluginRegistry,
  PluginRegistryEntry,
  PluginSource,
} from '@recompose/contracts';

import { parsePluginRegistry, pluginManifestSchema } from '@recompose/contracts';
import { createHash } from 'node:crypto';

import { parsedJson } from './gateway-wire';

export const defaultPluginRegistryUrl =
  'https://raw.githubusercontent.com/router-for-me/CLIProxyAPI-Plugins-Store/main/registry.json';

export function parsePluginRegistryJson(text: string): PluginRegistry {
  return parsePluginRegistry(parsedJson(text));
}

export function pluginSourceId(url: string): string {
  return `source-${createHash('sha256').update(url.trim()).digest('hex').slice(0, 12)}`;
}

function pluginSourceName(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname : url.trim();
}

function sourceFor(url: string): PluginSource {
  return { id: pluginSourceId(url), name: pluginSourceName(url), url };
}

export function normalizePluginSources(urls: readonly string[]): PluginSource[] {
  const official = { id: 'official', name: 'Official', url: defaultPluginRegistryUrl };
  const seen = new Set([defaultPluginRegistryUrl]);
  const sources = [official];

  for (const raw of urls) {
    const url = raw.trim();

    if (url === '' || seen.has(url)) continue;

    seen.add(url);
    sources.push(sourceFor(url));
  }

  return sources;
}

export function pluginArtifacts(plugin: PluginRegistryEntry): PluginArtifact[] {
  const current = plugin.install.type === 'direct' ? plugin.install.artifacts : [];
  const historical = plugin.versions.flatMap((version) =>
    version.install.type === 'direct' ? version.install.artifacts : [],
  );

  return [...current, ...historical];
}

export function selectPluginArtifact(
  plan: PluginInstallPlan,
  operatingSystem: string,
  architecture: string,
): PluginArtifact | null {
  if (plan.type !== 'direct') return null;

  return (
    plan.artifacts.find(
      (artifact) => artifact.goos === operatingSystem && artifact.goarch === architecture,
    ) ?? null
  );
}

export function verifyPluginArtifact(artifact: PluginArtifact, data: Uint8Array): boolean {
  return createHash('sha256').update(data).digest('hex') === artifact.sha256;
}

function normalizedVersion(version: string): string {
  return version.trim().replace(/^v/iu, '');
}

function numericVersion(version: string): number[] | null {
  const segments = normalizedVersion(version).split('.');

  return segments.every((segment) => /^\d+$/u.test(segment))
    ? segments.map((segment) => Number(segment))
    : null;
}

function versionPart(parts: readonly number[], index: number): number {
  return parts[index] ?? 0;
}

function versionOrder(left: number, right: number): number {
  return left < right ? -1 : 1;
}

function compareNumericVersions(installed: readonly number[], latest: readonly number[]): number {
  const length = Math.max(installed.length, latest.length);

  for (let index = 0; index < length; index += 1) {
    const left = versionPart(installed, index);
    const right = versionPart(latest, index);

    if (left !== right) return versionOrder(left, right);
  }

  return 0;
}

function missingOrEqualVersion(installed: string, latest: string): boolean {
  return installed === '' || latest === '' || installed === latest;
}

export function pluginUpdateAvailable(installed: string, latest: string): boolean {
  const installedVersion = normalizedVersion(installed);
  const latestVersion = normalizedVersion(latest);

  if (missingOrEqualVersion(installedVersion, latestVersion)) return false;

  const installedNumeric = numericVersion(installedVersion);
  const latestNumeric = numericVersion(latestVersion);

  return installedNumeric === null || latestNumeric === null
    ? true
    : compareNumericVersions(installedNumeric, latestNumeric) < 0;
}

function versionedPlugin(plugin: PluginRegistryEntry, version: string): PluginRegistryEntry | null {
  const normalized = normalizedVersion(version);

  if (plugin.version === normalized) return plugin;

  const selected = plugin.versions.find((candidate) => candidate.version === normalized);

  return selected === undefined
    ? null
    : { ...plugin, version: normalized, install: selected.install };
}

export function pluginManifestFrom(
  source: PluginSource,
  plugin: PluginRegistryEntry,
  version = plugin.version,
): PluginManifest {
  const selected = versionedPlugin(plugin, version);

  if (selected === null) throw new Error(`plugin version ${version} is unavailable`);

  const direct = selected.install.type === 'direct';
  const releaseTag = direct ? '' : `v${selected.version}`;

  return pluginManifestSchema.parse({
    schema_version: direct ? 2 : 1,
    id: selected.id,
    name: selected.name,
    description: selected.description,
    author: selected.author,
    version: selected.version,
    release_tag: releaseTag,
    repository: selected.repository,
    logo: selected.logo,
    homepage: selected.homepage,
    license: selected.license,
    tags: selected.tags,
    source_id: source.id,
    source_name: source.name,
    source_url: source.url,
    install: selected.install,
  });
}
