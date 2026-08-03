import { z } from 'zod';

import { keyCheckVerdictSchema, keyProviderIdSchema } from './api-keys';
import { gatewayEngineStateSchema } from './engine-state';
import { gatewayPortSchema, gatewaySlugSchema } from './gateway-config';
import { loopbackAddressSchema, runtimeReachabilitySchema } from './local-runtimes';
import { nonBlankString } from './non-blank';

export const engineGatewaySchema = z.strictObject({
  slug: gatewaySlugSchema,
  displayName: z.string().trim().min(1),
  port: gatewayPortSchema,
});

export type EngineGateway = z.infer<typeof engineGatewaySchema>;

export const directiveIdSchema = z.string().trim().min(1);

export const engineDirectiveSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('start'),
    id: directiveIdSchema,
    gateway: engineGatewaySchema,
  }),
  z.strictObject({ kind: z.literal('stop'), id: directiveIdSchema, slug: gatewaySlugSchema }),
  z.strictObject({
    kind: z.literal('probe'),
    id: directiveIdSchema,
    provider: keyProviderIdSchema,
    key: nonBlankString,
  }),
  z.strictObject({
    kind: z.literal('probe-runtime'),
    id: directiveIdSchema,
    address: loopbackAddressSchema,
  }),
]);

export type EngineDirective = z.infer<typeof engineDirectiveSchema>;

export const engineReportSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('state'),
    answers: directiveIdSchema,
    slug: gatewaySlugSchema,
    state: gatewayEngineStateSchema,
  }),
  z.strictObject({
    kind: z.literal('key-check'),
    answers: directiveIdSchema,
    verdict: keyCheckVerdictSchema,
    status: z.number().int().optional(),
  }),
  z.strictObject({
    kind: z.literal('runtime-check'),
    answers: directiveIdSchema,
    reachability: runtimeReachabilitySchema,
  }),
]);

export type EngineReport = z.infer<typeof engineReportSchema>;
