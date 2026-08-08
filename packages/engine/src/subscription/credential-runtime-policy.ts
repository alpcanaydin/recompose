import type { CredentialConcurrencyPolicy, CredentialPolicy } from '@recompose/contracts';

import type {
  CredentialRuntimePolicy,
  ResolvedCredentialConcurrencyPolicy,
  ResolvedCredentialInFlightPolicy,
} from './credential-policy-defaults';

import {
  DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
  resolveCredentialPolicyDefaults,
} from './credential-policy-defaults';

export type {
  CredentialRuntimePolicy,
  ResolvedCredentialConcurrencyPolicy,
  ResolvedCredentialInFlightPolicy,
} from './credential-policy-defaults';
export {
  DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
  DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
} from './credential-policy-defaults';

const MAX_CONCURRENCY_LIMIT = DEFAULT_CREDENTIAL_CONCURRENCY_POLICY.maxLimit;

export function resolveCredentialRuntimePolicy(policy?: CredentialPolicy): CredentialRuntimePolicy {
  rejectExplicitZeroLifecycleRevision(policy?.concurrency);
  const resolved = resolveCredentialPolicyDefaults(policy);

  validateCredentialInFlightPolicy(resolved.inFlight);
  validateCredentialConcurrencyPolicy(resolved.concurrency);

  return resolved;
}

export function validateCredentialInFlightPolicy(policy: ResolvedCredentialInFlightPolicy): void {
  requirePositiveInteger(policy.snapshotIntervalMs, 'snapshot interval');
  requirePositiveInteger(policy.staleAfterMs, 'stale interval');
  requirePositiveInteger(policy.stagingRetentionMs, 'staging retention');

  if (policy.snapshotIntervalMs > Math.floor(policy.staleAfterMs / 3)) {
    throw new Error('credential in-flight stale interval must be at least three snapshots');
  }

  validateInFlightStorageBounds(policy);
}

export function validateCredentialConcurrencyPolicy(
  policy: ResolvedCredentialConcurrencyPolicy,
): void {
  requireNonNegativeInteger(policy.lifecycleConfigRevision, 'lifecycle revision');
  requireNonNegativeInteger(policy.observationBarrierRevision, 'observation barrier revision');

  for (const [name, value] of concurrencyDurations(policy)) {
    requirePositiveInteger(value, name);
  }

  validateConcurrencyRelationships(policy);
  validateMaximumLimit(policy.maxLimit);
}

function validateConcurrencyRelationships(policy: ResolvedCredentialConcurrencyPolicy): void {
  if (policy.releaseMaxBackoffMs < policy.releaseFlushIntervalMs) {
    throw new Error('credential concurrency release backoff must cover the flush interval');
  }

  if (policy.busyRetryMaxMs < policy.busyRetryMinMs) {
    throw new Error('credential concurrency retry maximum must cover the minimum');
  }
}

function validateMaximumLimit(maximum: number): void {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > MAX_CONCURRENCY_LIMIT) {
    throw new Error(
      `credential concurrency max limit must be between 1 and ${MAX_CONCURRENCY_LIMIT}`,
    );
  }
}

export function validateCredentialConcurrencyLifecycle(
  nodeHeartbeatTimeoutMs: number,
  policy: ResolvedCredentialConcurrencyPolicy,
): void {
  requirePositiveInteger(nodeHeartbeatTimeoutMs, 'node heartbeat timeout');
  validateCredentialConcurrencyPolicy(policy);

  const nodeSafetyWindow = safeDurationSum(nodeHeartbeatTimeoutMs, policy.reclaimGraceMs);
  const cpaSafetyWindow = safeDurationSum(policy.cpaHeartbeatTimeoutMs, policy.cpaCancelBoundMs);

  if (nodeSafetyWindow <= cpaSafetyWindow) {
    throw new Error(
      'node heartbeat plus reclaim grace must exceed CPA heartbeat plus cancel bound',
    );
  }
}

export class CredentialConcurrencyLimiter {
  readonly #activeByCredential = new Map<string, number>();
  readonly #policy: ResolvedCredentialConcurrencyPolicy;

  public constructor(policy: ResolvedCredentialConcurrencyPolicy) {
    validateCredentialConcurrencyPolicy(policy);
    this.#policy = policy;
  }

  public acquire(credentialId: string, limit: number): (() => void) | undefined {
    validateCredentialLimit(credentialId, limit, this.#policy.maxLimit);
    const active = this.active(credentialId);

    if (active >= limit) return undefined;

    this.#activeByCredential.set(credentialId, active + 1);
    let released = false;

    return () => {
      if (released) return;

      released = true;
      this.release(credentialId);
    };
  }

  public active(credentialId: string): number {
    return this.#activeByCredential.get(credentialId) ?? 0;
  }

  private release(credentialId: string): void {
    const active = this.active(credentialId);

    if (active <= 1) this.#activeByCredential.delete(credentialId);
    else this.#activeByCredential.set(credentialId, active - 1);
  }
}

function validateInFlightStorageBounds(policy: ResolvedCredentialInFlightPolicy): void {
  requirePositiveInteger(policy.maxPartBytes, 'maximum part bytes');
  requirePositiveInteger(policy.maxPartCount, 'maximum part count');
  requirePositiveInteger(policy.maxRevisionBytes, 'maximum revision bytes');
  requirePositiveInteger(policy.maxAggregateGroups, 'maximum aggregate groups');
  requireNonNegativeInteger(policy.maxDetails, 'maximum details');
  requirePositiveInteger(policy.maxStringBytes, 'maximum string bytes');

  validateInFlightPartBounds(policy);
  validateInFlightCollectionBounds(policy);
}

function validateInFlightPartBounds(policy: ResolvedCredentialInFlightPolicy): void {
  validatePartShape(policy);
  validateRevisionShape(policy);
}

function validatePartShape(policy: ResolvedCredentialInFlightPolicy): void {
  if (policy.maxPartBytes < 1_024 || policy.maxPartCount > 64)
    throw new Error('invalid part bounds');
}

function validateRevisionShape(policy: ResolvedCredentialInFlightPolicy): void {
  if (
    policy.maxRevisionBytes < policy.maxPartBytes ||
    policy.maxRevisionBytes > 16 * 1_024 * 1_024
  ) {
    throw new Error('maximum revision bytes are outside hard bounds');
  }

  if (Math.ceil(policy.maxRevisionBytes / policy.maxPartBytes) > policy.maxPartCount) {
    throw new Error('maximum revision bytes exceed part capacity');
  }
}

function validateInFlightCollectionBounds(policy: ResolvedCredentialInFlightPolicy): void {
  if (policy.maxAggregateGroups > 100_000 || policy.maxDetails > 10_000) {
    throw new Error('credential in-flight collection bounds are invalid');
  }

  if (policy.maxStringBytes > 256) throw new Error('maximum string bytes exceed hard bounds');
}

function concurrencyDurations(
  policy: ResolvedCredentialConcurrencyPolicy,
): readonly (readonly [string, number])[] {
  return [
    ['CPA heartbeat timeout', policy.cpaHeartbeatTimeoutMs],
    ['CPA cancel bound', policy.cpaCancelBoundMs],
    ['reclaim grace', policy.reclaimGraceMs],
    ['cleanup interval', policy.cleanupIntervalMs],
    ['release flush interval', policy.releaseFlushIntervalMs],
    ['release maximum backoff', policy.releaseMaxBackoffMs],
    ['busy retry minimum', policy.busyRetryMinMs],
    ['busy retry maximum', policy.busyRetryMaxMs],
  ];
}

function safeDurationSum(left: number, right: number): number {
  if (left > Number.MAX_SAFE_INTEGER - right) {
    throw new Error('credential concurrency lifecycle timing safety invariant overflows');
  }

  return left + right;
}

function rejectExplicitZeroLifecycleRevision(policy?: CredentialConcurrencyPolicy): void {
  if (policy?.lifecycleConfigRevision === 0) {
    throw new Error('lifecycle configuration revision must be positive when present');
  }
}

function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`);
}

function requireNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must not be negative`);
}

function validateCredentialLimit(credentialId: string, limit: number, maximum: number): void {
  if (credentialId.trim() === '') throw new Error('credential id must not be blank');

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum) {
    throw new Error(`credential concurrency limit must be between 1 and ${maximum}`);
  }
}
