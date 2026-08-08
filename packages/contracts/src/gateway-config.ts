import { z } from 'zod';

import { migrateDocument, type Migration } from './migration';
import { nonBlankString } from './non-blank';

export const GATEWAY_CONFIG_VERSION = 2;

export const GATEWAY_PORT_RANGE = { min: 1024, max: 65535 } as const;

export const gatewayPortSchema = z.int().min(GATEWAY_PORT_RANGE.min).max(GATEWAY_PORT_RANGE.max);

const WINDOWS_DEVICE_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

const GATEWAY_SLUG_MAX_LENGTH = 63;

export const gatewaySlugSchema = z
  .string()
  .max(GATEWAY_SLUG_MAX_LENGTH, `at most ${String(GATEWAY_SLUG_MAX_LENGTH)} characters`)
  .regex(/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9]))*$/, 'lowercase slug with single dashes')
  .refine((slug) => !WINDOWS_DEVICE_NAMES.has(slug), 'Windows reserves this name');

const FALLBACK_GATEWAY_SLUG = 'gateway';

function inBaseLetters(name: string): string {
  return name.toUpperCase().toLowerCase().normalize('NFD').replaceAll(/\p{M}/gu, '');
}

/**
 * The slug a gateway stores its file and its route under, read off the name a person gave it.
 *
 * @summary Nobody types a slug, so this is the only thing that writes one. It folds the name to
 * its base letters, joins what survives with single dashes, and stops at the hostname-label
 * bound. A name that leaves nothing behind falls back to `gateway`. A name landing on a device
 * name Windows reserves derives it unchanged, so `gatewaySlugSchema` refuses it where a person
 * can read the refusal and rename.
 */
export function slugFromName(displayName: string): string {
  const derived = inBaseLetters(displayName)
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-|-$/gu, '')
    .slice(0, GATEWAY_SLUG_MAX_LENGTH)
    .replace(/-$/u, '');

  return derived === '' ? FALLBACK_GATEWAY_SLUG : derived;
}

export const modelAliasSchema = z
  .string()
  .regex(/^[a-z0-9._-]+$/u, 'lowercase id of letters, digits, dots and dashes')
  .refine((id) => !/^[._-]|[._-]$/u.test(id), 'a model id starts and ends with a letter or digit');

/**
 * The id a client sends as its `model`, read off the name a person gave the virtual model.
 *
 * @summary Unlike the gateway slug, this keeps the dots real model names carry, so `Claude 5.6 Sol`
 * reaches a client as `claude-5.6-sol` rather than losing the dot to a dash. It folds the case
 * down, turns each run of anything outside the id charset into one dash, collapses repeated
 * separators, and trims the ends, so every id it derives is one the stored shape already accepts.
 */
export function modelAliasFromName(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/gu, '-')
    .replaceAll(/[-._]{2,}/gu, '-')
    .replace(/^[-._]/u, '')
    .replace(/[-._]$/u, '');
}

export const targetSchema = z.strictObject({
  accountId: nonBlankString,
  providerModel: nonBlankString,
});

export type Target = z.infer<typeof targetSchema>;

export const virtualModelSchema = z.strictObject({
  id: modelAliasSchema,
  displayName: nonBlankString,
  target: targetSchema,
});

export type VirtualModel = z.infer<typeof virtualModelSchema>;

const layoutSchema = z.strictObject({
  nodes: z.record(gatewaySlugSchema, z.strictObject({ x: z.number(), y: z.number() })),
  viewport: z
    .strictObject({ x: z.number(), y: z.number(), zoom: z.number().positive() })
    .optional(),
});

export const gatewayConfigSchema = z.strictObject({
  schemaVersion: z.literal(GATEWAY_CONFIG_VERSION),
  slug: gatewaySlugSchema,
  displayName: z.string().trim().min(1),
  port: gatewayPortSchema,
  virtualModels: z.array(virtualModelSchema),
  layout: layoutSchema,
});

export type GatewayConfig = z.infer<typeof gatewayConfigSchema>;

const noStoredGatewayEverMintedAVirtualModel: Migration = {
  from: 1,
  migrate: (doc) => ({ ...doc, schemaVersion: 2 }),
};

const gatewayConfigMigrations: readonly Migration[] = [noStoredGatewayEverMintedAVirtualModel];

export function loadGatewayConfig(doc: unknown): GatewayConfig {
  return gatewayConfigSchema.parse(
    migrateDocument(doc, gatewayConfigMigrations, GATEWAY_CONFIG_VERSION),
  );
}
