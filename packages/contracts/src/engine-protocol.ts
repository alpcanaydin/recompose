import { z } from 'zod';

import { keyCheckVerdictSchema, keyProviderIdSchema } from './api-keys';
import { gatewayEngineStateSchema } from './engine-state';
import { gatewayPortSchema, gatewaySlugSchema } from './gateway-config';
import { loopbackAddressSchema, runtimeReachabilitySchema } from './local-runtimes';
import { nonBlankString } from './non-blank';
import { subscriptionProviderIdSchema } from './subscriptions';

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

const subscriptionCustodyShape = {
  custody: z.literal('subscription'),
  provider: subscriptionProviderIdSchema,
  accountId: nonBlankString,
  credential: nonBlankString,
};

/**
 * How a look at a provider's model list spells the credential it was handed, or that it has none.
 *
 * @summary A first-party key rides the header its own vendor reads, which is why the arm names the
 * provider: Anthropic answers `x-api-key` beside its version and turns a bearer token away. Every
 * other credentialed account is an OpenAI-compatible bearer, and a runtime on this machine carries
 * nothing at all. Main resolves the arm from the stored account; the child spells the header.
 */
export const lookCustodySchema = z.discriminatedUnion('custody', [
  z.strictObject({
    custody: z.literal('provider-key'),
    provider: keyProviderIdSchema,
    credential: nonBlankString,
  }),
  z.strictObject({
    custody: z.literal('bearer'),
    provider: nonBlankString,
    credential: nonBlankString,
  }),
  z.strictObject(subscriptionCustodyShape),
  z.strictObject({ custody: z.literal('open') }),
]);

export type LookCustody = z.infer<typeof lookCustodySchema>;

/**
 * What one look at an account's model list read: the ids it serves, or that nothing could be read.
 *
 * @summary The unlisted arm carries no words, because a person reads the sentence the screen owns
 * rather than one the engine invented. An account that answered with no ids still stands as listed,
 * so a catalog that is genuinely empty never reads as a look that failed.
 */
export const modelListingSchema = z.discriminatedUnion('standing', [
  z.strictObject({ standing: z.literal('listed'), modelIds: z.array(nonBlankString) }),
  z.strictObject({ standing: z.literal('unlisted') }),
]);

export type ModelListing = z.infer<typeof modelListingSchema>;

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
  z.strictObject({
    kind: z.literal('list-models'),
    id: directiveIdSchema,
    origin: nonBlankString,
    custody: lookCustodySchema,
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
  z.strictObject({
    kind: z.literal('model-list'),
    answers: directiveIdSchema,
    listing: modelListingSchema,
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

const grantedSpendSchema = z.discriminatedUnion('custody', [
  z.strictObject({
    custody: z.literal('credentialed'),
    provider: nonBlankString,
    credential: nonBlankString,
  }),
  z.strictObject(subscriptionCustodyShape),
  z.strictObject({ custody: z.literal('open') }),
]);

export const spendGrantSchema = z.discriminatedUnion('verdict', [
  z.strictObject({
    verdict: z.literal('resolved'),
    providerOrigin: nonBlankString,
    spend: grantedSpendSchema,
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

export const engineSubscriptionCredentialUpdateSchema = z.strictObject({
  kind: z.literal('subscription-credential-update'),
  id: directiveIdSchema,
  provider: subscriptionProviderIdSchema,
  accountId: nonBlankString,
  credential: nonBlankString,
});

export type EngineSubscriptionCredentialUpdate = z.infer<
  typeof engineSubscriptionCredentialUpdateSchema
>;

export const engineSubscriptionCredentialUpdatedSchema = z.strictObject({
  kind: z.literal('subscription-credential-updated'),
  answers: directiveIdSchema,
  verdict: z.enum(['stored', 'failed']),
});

export type EngineSubscriptionCredentialUpdated = z.infer<
  typeof engineSubscriptionCredentialUpdatedSchema
>;
