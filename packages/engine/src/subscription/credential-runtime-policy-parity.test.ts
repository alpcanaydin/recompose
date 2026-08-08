import { credentialPolicySchema } from '@recompose/contracts';
import { expect, it } from 'vitest';

import {
  CredentialConcurrencyLimiter,
  DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
  DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
  resolveCredentialRuntimePolicy,
  validateCredentialConcurrencyLifecycle,
  validateCredentialConcurrencyPolicy,
  validateCredentialInFlightPolicy,
} from './credential-runtime-policy';

it('TestCredentialConcurrencyLifecycleFixture', () => {
  const defaults = resolveCredentialRuntimePolicy({
    concurrency: { lifecycleConfigRevision: 1 },
  }).concurrency;

  expect(defaults).toEqual({
    ...DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
    lifecycleConfigRevision: 1,
  });
  expect(() => {
    validateCredentialConcurrencyLifecycle(20_000, defaults);
  }).not.toThrow();
  expect(() => {
    validateCredentialConcurrencyLifecycle(3_000, defaults);
  }).toThrow();
  expect(() => {
    resolveCredentialRuntimePolicy({ concurrency: { cpaHeartbeatTimeoutMs: 0 } });
  }).toThrow();
});

it('TestLoadConfigOptionalMissingFallbackAppliesCredentialInFlightDefaults', () => {
  expect(resolveCredentialRuntimePolicy().inFlight).toEqual(DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY);
});

it('TestLoadConfigOptionalEmptyFallbackAppliesCredentialInFlightDefaults', () => {
  expect(resolveCredentialRuntimePolicy({}).inFlight).toEqual(DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY);
});

it('TestLoadConfigOptionalWhitespaceFallbackAppliesCredentialInFlightDefaults', () => {
  const parsed = credentialPolicySchema.safeParse(' \t\n\r ');
  const policy = parsed.success ? parsed.data : undefined;

  expect(resolveCredentialRuntimePolicy(policy).inFlight).toEqual(
    DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
  );
});

it('TestLoadConfigOptionalInvalidFallbackAppliesCredentialInFlightDefaults', () => {
  const parsed = credentialPolicySchema.safeParse(':');
  const policy = parsed.success ? parsed.data : undefined;

  expect(resolveCredentialRuntimePolicy(policy).inFlight).toEqual(
    DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
  );
});

it('TestCredentialInFlightConfigDurationBounds', () => {
  expect(() => {
    validateCredentialInFlightPolicy({
      ...DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
      snapshotIntervalMs: 1_000,
      staleAfterMs: 3_000,
    });
  }).not.toThrow();
  expect(() => {
    validateCredentialInFlightPolicy({
      ...DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
      snapshotIntervalMs: 1_000,
      staleAfterMs: 2_999,
    });
  }).toThrow();
  expect(() => {
    validateCredentialInFlightPolicy({
      ...DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
      snapshotIntervalMs: Math.floor(Number.MAX_SAFE_INTEGER / 2),
      staleAfterMs: Number.MAX_SAFE_INTEGER,
    });
  }).toThrow();
});

it('TestCredentialInFlightConfigRejectsUnsafeBounds', () => {
  expect(() => {
    validateCredentialInFlightPolicy({
      ...DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
      staleAfterMs: 5_000,
    });
  }).toThrow();
  expect(() => {
    validateCredentialInFlightPolicy({
      ...DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
      maxRevisionBytes: 16 * 1_024 * 1_024 + 1,
    });
  }).toThrow();
  expect(() => {
    validateCredentialInFlightPolicy({
      ...DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
      maxPartBytes: Number.MAX_SAFE_INTEGER,
    });
  }).toThrow();
});

it('TestCredentialConcurrencyLimiterConfig', () => {
  const policy = resolveCredentialRuntimePolicy().concurrency;
  const limiter = new CredentialConcurrencyLimiter(policy);
  const first = limiter.acquire('credential-a', 1);

  expect(policy).toEqual(DEFAULT_CREDENTIAL_CONCURRENCY_POLICY);
  expect(() => {
    validateCredentialConcurrencyLifecycle(20_000, policy);
  }).not.toThrow();
  expect(() => {
    validateCredentialConcurrencyLifecycle(2_000, policy);
  }).toThrow();
  expect(first).toBeTypeOf('function');
  expect(limiter.acquire('credential-a', 1)).toBeUndefined();
  expect(limiter.acquire('credential-b', 1)).toBeTypeOf('function');

  first?.();
  first?.();
  expect(limiter.active('credential-a')).toBe(0);
  expect(limiter.acquire('credential-a', 1)).toBeTypeOf('function');
});

it('TestCredentialConcurrencyConfigDefaultsOnlyMissingFields', () => {
  const resolved = resolveCredentialRuntimePolicy({
    concurrency: { maxLimit: 4, busyRetryMaxMs: 500 },
  }).concurrency;

  expect(resolved.maxLimit).toBe(4);
  expect(resolved.busyRetryMaxMs).toBe(500);
  expect(resolved.busyRetryMinMs).toBe(250);
  expect(resolved.cpaHeartbeatTimeoutMs).toBe(3_000);

  expect(() => {
    resolveCredentialRuntimePolicy({ concurrency: { lifecycleConfigRevision: 0 } });
  }).toThrow();
  expect(() => {
    resolveCredentialRuntimePolicy({ concurrency: { cpaHeartbeatTimeoutMs: 0 } });
  }).toThrow();
  expect(() => {
    resolveCredentialRuntimePolicy({ concurrency: { observationBarrierRevision: -1 } });
  }).toThrow();
});

it('TestCredentialConcurrencyConfigRejectsInvalidLimiter', () => {
  expect(() => {
    validateCredentialConcurrencyPolicy({
      ...DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
      releaseFlushIntervalMs: 1_000,
      releaseMaxBackoffMs: 500,
    });
  }).toThrow();
  expect(() => {
    validateCredentialConcurrencyPolicy({
      ...DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
      busyRetryMinMs: 1.5,
    });
  }).toThrow();
  expect(() => {
    validateCredentialConcurrencyPolicy({
      ...DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
      maxLimit: 1_000_001,
    });
  }).toThrow();
});

it('TestValidateCredentialConcurrencyLifecycleRejectsSafetyOverflow', () => {
  const policy = {
    ...DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
    lifecycleConfigRevision: 1,
    cpaHeartbeatTimeoutMs: Number.MAX_SAFE_INTEGER,
    cpaCancelBoundMs: 1,
  };

  expect(() => {
    validateCredentialConcurrencyLifecycle(1_000, policy);
  }).toThrow(/overflows/);
});
