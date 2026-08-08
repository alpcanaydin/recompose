import { z } from 'zod';

const integer = z.number().int();

export const credentialInFlightPolicySchema = z.strictObject({
  snapshotIntervalMs: integer.optional(),
  staleAfterMs: integer.optional(),
  maxPartBytes: integer.optional(),
  maxPartCount: integer.optional(),
  maxRevisionBytes: integer.optional(),
  maxAggregateGroups: integer.optional(),
  maxDetails: integer.optional(),
  maxStringBytes: integer.optional(),
  stagingRetentionMs: integer.optional(),
});

export type CredentialInFlightPolicy = z.infer<typeof credentialInFlightPolicySchema>;

export const credentialConcurrencyPolicySchema = z.strictObject({
  lifecycleConfigRevision: integer.optional(),
  observationBarrierRevision: integer.optional(),
  cpaHeartbeatTimeoutMs: integer.optional(),
  cpaCancelBoundMs: integer.optional(),
  reclaimGraceMs: integer.optional(),
  cleanupIntervalMs: integer.optional(),
  releaseFlushIntervalMs: integer.optional(),
  releaseMaxBackoffMs: integer.optional(),
  busyRetryMinMs: integer.optional(),
  busyRetryMaxMs: integer.optional(),
  maxLimit: integer.optional(),
});

export type CredentialConcurrencyPolicy = z.infer<typeof credentialConcurrencyPolicySchema>;

export const credentialPolicySchema = z.strictObject({
  inFlight: credentialInFlightPolicySchema.optional(),
  concurrency: credentialConcurrencyPolicySchema.optional(),
});

export type CredentialPolicy = z.infer<typeof credentialPolicySchema>;
