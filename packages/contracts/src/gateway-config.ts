import { z } from 'zod';

import { migrateDocument, type Migration } from './migration';
import { nonBlankString } from './non-blank';

export const GATEWAY_CONFIG_VERSION = 1;

export const gatewaySlugSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9]))*$/, 'lowercase slug with single dashes');

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
  virtualModels: z.array(virtualModelSchema).min(1),
  layout: layoutSchema,
});

export type GatewayConfig = z.infer<typeof gatewayConfigSchema>;

const gatewayConfigMigrations: readonly Migration[] = [];

export function loadGatewayConfig(doc: unknown): GatewayConfig {
  return gatewayConfigSchema.parse(
    migrateDocument(doc, gatewayConfigMigrations, GATEWAY_CONFIG_VERSION),
  );
}
