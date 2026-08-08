import type {
  CredentialConcurrencyPolicy,
  CredentialInFlightPolicy,
  CredentialPolicy,
} from '@recompose/contracts';

type DefinedProperties<T> = { [Key in keyof T]-?: Exclude<T[Key], undefined> };

export type ResolvedCredentialInFlightPolicy = DefinedProperties<CredentialInFlightPolicy>;
export type ResolvedCredentialConcurrencyPolicy = DefinedProperties<CredentialConcurrencyPolicy>;

export type CredentialRuntimePolicy = {
  inFlight: ResolvedCredentialInFlightPolicy;
  concurrency: ResolvedCredentialConcurrencyPolicy;
};

export const DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY: ResolvedCredentialInFlightPolicy = {
  snapshotIntervalMs: 2_000,
  staleAfterMs: 10_000,
  maxPartBytes: 256 * 1_024,
  maxPartCount: 64,
  maxRevisionBytes: 16 * 1_024 * 1_024,
  maxAggregateGroups: 100_000,
  maxDetails: 10_000,
  maxStringBytes: 256,
  stagingRetentionMs: 60_000,
};

export const DEFAULT_CREDENTIAL_CONCURRENCY_POLICY: ResolvedCredentialConcurrencyPolicy = {
  lifecycleConfigRevision: 0,
  observationBarrierRevision: 0,
  cpaHeartbeatTimeoutMs: 3_000,
  cpaCancelBoundMs: 5_000,
  reclaimGraceMs: 5_000,
  cleanupIntervalMs: 5_000,
  releaseFlushIntervalMs: 250,
  releaseMaxBackoffMs: 2_000,
  busyRetryMinMs: 250,
  busyRetryMaxMs: 1_000,
  maxLimit: 1_000_000,
};

export function resolveCredentialPolicyDefaults(
  policy?: CredentialPolicy,
): CredentialRuntimePolicy {
  return {
    inFlight: resolveInFlightPolicy(policy?.inFlight),
    concurrency: resolveConcurrencyPolicy(policy?.concurrency),
  };
}

function resolveInFlightPolicy(
  policy?: CredentialInFlightPolicy,
): ResolvedCredentialInFlightPolicy {
  const resolved = { ...DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY };

  if (policy === undefined) return resolved;

  applyInFlightTiming(resolved, policy);
  applyInFlightParts(resolved, policy);
  applyInFlightCollections(resolved, policy);

  return resolved;
}

function resolveConcurrencyPolicy(
  policy?: CredentialConcurrencyPolicy,
): ResolvedCredentialConcurrencyPolicy {
  const resolved = { ...DEFAULT_CREDENTIAL_CONCURRENCY_POLICY };

  if (policy === undefined) return resolved;

  applyConcurrencyLifecycle(resolved, policy);
  applyConcurrencyRelease(resolved, policy);
  applyConcurrencyRetry(resolved, policy);

  return resolved;
}

function applyInFlightTiming(
  resolved: ResolvedCredentialInFlightPolicy,
  policy: CredentialInFlightPolicy,
): void {
  if (policy.snapshotIntervalMs !== undefined)
    resolved.snapshotIntervalMs = policy.snapshotIntervalMs;
  if (policy.staleAfterMs !== undefined) resolved.staleAfterMs = policy.staleAfterMs;
  if (policy.stagingRetentionMs !== undefined)
    resolved.stagingRetentionMs = policy.stagingRetentionMs;
}

function applyInFlightParts(
  resolved: ResolvedCredentialInFlightPolicy,
  policy: CredentialInFlightPolicy,
): void {
  if (policy.maxPartBytes !== undefined) resolved.maxPartBytes = policy.maxPartBytes;
  if (policy.maxPartCount !== undefined) resolved.maxPartCount = policy.maxPartCount;
  if (policy.maxRevisionBytes !== undefined) resolved.maxRevisionBytes = policy.maxRevisionBytes;
}

function applyInFlightCollections(
  resolved: ResolvedCredentialInFlightPolicy,
  policy: CredentialInFlightPolicy,
): void {
  if (policy.maxAggregateGroups !== undefined)
    resolved.maxAggregateGroups = policy.maxAggregateGroups;
  if (policy.maxDetails !== undefined) resolved.maxDetails = policy.maxDetails;
  if (policy.maxStringBytes !== undefined) resolved.maxStringBytes = policy.maxStringBytes;
}

function applyConcurrencyLifecycle(
  resolved: ResolvedCredentialConcurrencyPolicy,
  policy: CredentialConcurrencyPolicy,
): void {
  if (policy.lifecycleConfigRevision !== undefined)
    resolved.lifecycleConfigRevision = policy.lifecycleConfigRevision;
  if (policy.observationBarrierRevision !== undefined)
    resolved.observationBarrierRevision = policy.observationBarrierRevision;
  if (policy.cpaHeartbeatTimeoutMs !== undefined)
    resolved.cpaHeartbeatTimeoutMs = policy.cpaHeartbeatTimeoutMs;
  if (policy.cpaCancelBoundMs !== undefined) resolved.cpaCancelBoundMs = policy.cpaCancelBoundMs;
}

function applyConcurrencyRelease(
  resolved: ResolvedCredentialConcurrencyPolicy,
  policy: CredentialConcurrencyPolicy,
): void {
  if (policy.reclaimGraceMs !== undefined) resolved.reclaimGraceMs = policy.reclaimGraceMs;
  if (policy.cleanupIntervalMs !== undefined) resolved.cleanupIntervalMs = policy.cleanupIntervalMs;
  if (policy.releaseFlushIntervalMs !== undefined)
    resolved.releaseFlushIntervalMs = policy.releaseFlushIntervalMs;
  if (policy.releaseMaxBackoffMs !== undefined)
    resolved.releaseMaxBackoffMs = policy.releaseMaxBackoffMs;
}

function applyConcurrencyRetry(
  resolved: ResolvedCredentialConcurrencyPolicy,
  policy: CredentialConcurrencyPolicy,
): void {
  if (policy.busyRetryMinMs !== undefined) resolved.busyRetryMinMs = policy.busyRetryMinMs;
  if (policy.busyRetryMaxMs !== undefined) resolved.busyRetryMaxMs = policy.busyRetryMaxMs;
  if (policy.maxLimit !== undefined) resolved.maxLimit = policy.maxLimit;
}
