import { z } from 'zod';

const pluginId = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u);
const pluginVersion = z
  .string()
  .trim()
  .regex(/^[0-9][0-9A-Za-z.+-]*$/u);
const displayText = z.string().trim().min(1);
const optionalText = z.string().trim().optional().default('');
const sha256 = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-f0-9]{64}$/u);

function normalizedOperatingSystem(value: string): string {
  const normalized = value.trim().toLowerCase();

  return normalized === 'macos' || normalized === 'osx' ? 'darwin' : normalized;
}

function normalizedArchitecture(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'x64' || normalized === 'x86_64') return 'amd64';

  return normalized === 'aarch64' ? 'arm64' : normalized;
}

function artifactURLChecks(url: URL): readonly (readonly [boolean, string])[] {
  return [
    [url.protocol !== 'https:', 'artifact URL must use HTTPS'],
    [url.username !== '' || url.password !== '', 'artifact URL must not contain credentials'],
    [url.search !== '', 'artifact URL must not contain query parameters'],
    [url.hash !== '', 'artifact URL must not contain a fragment'],
  ];
}

function secureArtifactUrl(value: string, context: z.RefinementCtx): void {
  if (!URL.canParse(value)) {
    context.addIssue({ code: 'custom', message: 'artifact URL is invalid' });

    return;
  }

  const url = new URL(value);

  for (const [invalid, message] of artifactURLChecks(url)) {
    if (invalid) context.addIssue({ code: 'custom', message });
  }
}

export const pluginArtifactSchema = z
  .strictObject({
    goos: z.string().transform(normalizedOperatingSystem),
    goarch: z.string().transform(normalizedArchitecture),
    url: z.string().trim().superRefine(secureArtifactUrl),
    sha256,
    size: z.number().int().positive().optional(),
  })
  .superRefine((artifact, context) => {
    if (!['darwin', 'linux', 'windows'].includes(artifact.goos)) {
      context.addIssue({ code: 'custom', path: ['goos'], message: 'unsupported operating system' });
    }

    if (!['amd64', 'arm64'].includes(artifact.goarch)) {
      context.addIssue({ code: 'custom', path: ['goarch'], message: 'unsupported architecture' });
    }
  });

export type PluginArtifact = z.infer<typeof pluginArtifactSchema>;

export const pluginInstallPlanSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('github-release') }),
  z.strictObject({ type: z.literal('direct'), artifacts: z.array(pluginArtifactSchema).min(1) }),
]);

export type PluginInstallPlan = z.infer<typeof pluginInstallPlanSchema>;

const pluginVersionEntrySchema = z.strictObject({
  version: pluginVersion,
  install: pluginInstallPlanSchema,
});

export const pluginRegistryEntrySchema = z.strictObject({
  id: pluginId,
  name: displayText,
  description: displayText,
  author: displayText,
  version: pluginVersion.optional().default(''),
  versions: z.array(pluginVersionEntrySchema).optional().default([]),
  repository: optionalText,
  logo: optionalText,
  homepage: optionalText,
  license: optionalText,
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  install: pluginInstallPlanSchema.optional().default({ type: 'github-release' }),
  auth_required: z.boolean().optional().default(false),
});

export type PluginRegistryEntry = z.infer<typeof pluginRegistryEntrySchema>;

function githubRepository(repository: string): boolean {
  if (!URL.canParse(repository)) return false;

  const url = new URL(repository);
  const parts = url.pathname.split('/').filter(Boolean);

  return url.protocol === 'https:' && url.hostname === 'github.com' && parts.length === 2;
}

function invalidRepository(plugin: PluginRegistryEntry): boolean {
  return plugin.repository !== '' && !githubRepository(plugin.repository);
}

function directRequiresV2(schemaVersion: number, plugin: PluginRegistryEntry): boolean {
  return schemaVersion === 1 && plugin.install.type === 'direct';
}

function validateRegistryPlugin(
  plugin: PluginRegistryEntry,
  index: number,
  schemaVersion: number,
  seen: Set<string>,
  context: z.RefinementCtx,
): void {
  if (seen.has(plugin.id)) {
    context.addIssue({
      code: 'custom',
      path: ['plugins', index, 'id'],
      message: 'duplicate plugin id',
    });
  }

  seen.add(plugin.id);

  if (invalidRepository(plugin)) {
    context.addIssue({
      code: 'custom',
      path: ['plugins', index, 'repository'],
      message: 'repository must be a GitHub repository URL',
    });
  }

  if (directRequiresV2(schemaVersion, plugin)) {
    context.addIssue({
      code: 'custom',
      path: ['plugins', index, 'install'],
      message: 'direct install requires schema_version 2',
    });
  }
}

export const pluginRegistrySchema = z
  .strictObject({
    schema_version: z.union([z.literal(1), z.literal(2)]),
    plugins: z.array(pluginRegistryEntrySchema),
  })
  .superRefine((registry, context) => {
    const seen = new Set<string>();

    for (const [index, plugin] of registry.plugins.entries()) {
      validateRegistryPlugin(plugin, index, registry.schema_version, seen, context);
    }
  });

export type PluginRegistry = z.infer<typeof pluginRegistrySchema>;

export const pluginSourceSchema = z.strictObject({
  id: displayText,
  name: displayText,
  url: z.string().trim().pipe(z.url()),
});

export type PluginSource = z.infer<typeof pluginSourceSchema>;

const pluginManifestObjectSchema = z.strictObject({
  schema_version: z
    .union([z.literal(1), z.literal(2)])
    .optional()
    .default(1),
  id: pluginId,
  name: displayText,
  description: displayText,
  author: displayText,
  version: pluginVersion,
  release_tag: optionalText,
  repository: optionalText,
  logo: optionalText,
  homepage: optionalText,
  license: optionalText,
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  source_id: displayText,
  source_name: displayText,
  source_url: z.string().trim().pipe(z.url()),
  install: pluginInstallPlanSchema,
});

export const pluginManifestSchema = pluginManifestObjectSchema.superRefine(validateManifest);

function validateManifest(
  manifest: z.infer<typeof pluginManifestObjectSchema>,
  context: z.RefinementCtx,
): void {
  if (manifest.install.type === 'direct') validateDirectManifest(manifest, context);
  else validateReleaseManifest(manifest, context);
}

function validateDirectManifest(
  manifest: { schema_version: number },
  context: z.RefinementCtx,
): void {
  if (manifest.schema_version !== 2) {
    context.addIssue({
      code: 'custom',
      path: ['schema_version'],
      message: 'direct install requires schema_version 2',
    });
  }
}

function validateReleaseManifest(
  manifest: { release_tag: string; version: string },
  context: z.RefinementCtx,
): void {
  const releaseVersion = manifest.release_tag.replace(/^v/iu, '');

  if (manifest.release_tag === '') {
    context.addIssue({ code: 'custom', path: ['release_tag'], message: 'release tag is required' });
  } else if (releaseVersion !== manifest.version) {
    context.addIssue({
      code: 'custom',
      path: ['release_tag'],
      message: 'release tag version mismatch',
    });
  }
}

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export function parsePluginRegistry(value: unknown): PluginRegistry {
  return pluginRegistrySchema.parse(value);
}
