import { z } from 'zod';

import { keyCheckVerdictSchema, keyProviderIdSchema } from './api-keys';
import { gatewayEngineStateSchema } from './engine-state';
import { gatewayPortSchema, gatewaySlugSchema } from './gateway-config';
import { loopbackAddressSchema, runtimeReachabilitySchema } from './local-runtimes';
import { nonBlankString } from './non-blank';

const targetStandingSchema = z.discriminatedUnion('standing', [
  z.strictObject({ standing: z.literal('bound'), providerModel: nonBlankString }),
  z.strictObject({ standing: z.literal('removed') }),
]);

export const engineVirtualModelSchema = z.strictObject({
  id: gatewaySlugSchema,
  displayName: nonBlankString,
  target: targetStandingSchema,
});

export type EngineVirtualModel = z.infer<typeof engineVirtualModelSchema>;

export const engineGatewaySchema = z.strictObject({
  slug: gatewaySlugSchema,
  displayName: z.string().trim().min(1),
  port: gatewayPortSchema,
  virtualModels: z.array(engineVirtualModelSchema),
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

export const engineSpendRequestSchema = z.strictObject({
  kind: z.literal('spend-request'),
  id: directiveIdSchema,
  slug: gatewaySlugSchema,
  virtualModel: gatewaySlugSchema,
});

export type EngineSpendRequest = z.infer<typeof engineSpendRequestSchema>;

export const spendGrantSchema = z.discriminatedUnion('verdict', [
  z.strictObject({
    verdict: z.literal('resolved'),
    credential: nonBlankString,
    providerOrigin: nonBlankString,
  }),
  z.strictObject({ verdict: z.literal('missing-target') }),
  z.strictObject({ verdict: z.literal('missing-credential') }),
]);

export type SpendGrant = z.infer<typeof spendGrantSchema>;

export const engineSpendGrantSchema = z.strictObject({
  kind: z.literal('spend-grant'),
  answers: directiveIdSchema,
  grant: spendGrantSchema,
});

export type EngineSpendGrant = z.infer<typeof engineSpendGrantSchema>;
