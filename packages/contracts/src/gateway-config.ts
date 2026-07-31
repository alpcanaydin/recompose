import { z } from 'zod';

import { migrateDocument, type Migration } from './migration';
import { nonBlankString } from './non-blank';

export const GATEWAY_CONFIG_VERSION = 1;

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

const targetSchema = z.strictObject({
  kind: z.literal('target'),
  id: nonBlankString,
  accountId: nonBlankString,
  providerModel: nonBlankString,
  weight: z.int().min(0).max(100),
});

export type RoutingNode =
  | z.infer<typeof targetSchema>
  | {
      kind: 'router';
      id: string;
      mode: 'failover' | 'round-robin';
      children: RoutingNode[];
    };

const routingNodeSchema: z.ZodType<RoutingNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    targetSchema,
    z.strictObject({
      kind: z.literal('router'),
      id: nonBlankString,
      mode: z.enum(['failover', 'round-robin']),
      children: z.array(routingNodeSchema).min(1),
    }),
  ]),
);

const virtualModelSchema = z.strictObject({
  id: nonBlankString,
  slug: gatewaySlugSchema,
  displayName: z.string().trim().min(1),
  routing: routingNodeSchema,
});

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

const gatewayConfigMigrations: readonly Migration[] = [];

export function loadGatewayConfig(doc: unknown): GatewayConfig {
  return gatewayConfigSchema.parse(
    migrateDocument(doc, gatewayConfigMigrations, GATEWAY_CONFIG_VERSION),
  );
}
