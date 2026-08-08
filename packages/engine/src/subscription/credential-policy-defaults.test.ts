import type { CredentialConcurrencyPolicy, CredentialInFlightPolicy } from '@recompose/contracts';

import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import type {
  ResolvedCredentialConcurrencyPolicy,
  ResolvedCredentialInFlightPolicy,
} from './credential-policy-defaults';

import {
  DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
  DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
  resolveCredentialPolicyDefaults,
} from './credential-policy-defaults';

type InFlightKey = keyof ResolvedCredentialInFlightPolicy;
type ConcurrencyKey = keyof ResolvedCredentialConcurrencyPolicy;

const inFlightKeys: InFlightKey[] = [
  'snapshotIntervalMs',
  'staleAfterMs',
  'maxPartBytes',
  'maxPartCount',
  'maxRevisionBytes',
  'maxAggregateGroups',
  'maxDetails',
  'maxStringBytes',
  'stagingRetentionMs',
];

const concurrencyKeys: ConcurrencyKey[] = [
  'lifecycleConfigRevision',
  'observationBarrierRevision',
  'cpaHeartbeatTimeoutMs',
  'cpaCancelBoundMs',
  'reclaimGraceMs',
  'cleanupIntervalMs',
  'releaseFlushIntervalMs',
  'releaseMaxBackoffMs',
  'busyRetryMinMs',
  'busyRetryMaxMs',
  'maxLimit',
];

function inFlightWith(key: InFlightKey, value: number): CredentialInFlightPolicy {
  const policy: CredentialInFlightPolicy = {};

  policy[key] = value;

  return policy;
}

function concurrencyWith(key: ConcurrencyKey, value: number): CredentialConcurrencyPolicy {
  const policy: CredentialConcurrencyPolicy = {};

  policy[key] = value;

  return policy;
}

function statedInFlight(value: number): ResolvedCredentialInFlightPolicy {
  const stated = { ...DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY };

  for (const key of inFlightKeys) stated[key] = value;

  return stated;
}

function statedConcurrency(value: number): ResolvedCredentialConcurrencyPolicy {
  const stated = { ...DEFAULT_CREDENTIAL_CONCURRENCY_POLICY };

  for (const key of concurrencyKeys) stated[key] = value;

  return stated;
}

describe('an absent credential policy falls back to the shipped defaults', () => {
  test('no policy at all resolves to both default groups', () => {
    expect(resolveCredentialPolicyDefaults()).toEqual({
      inFlight: DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
      concurrency: DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
    });
  });

  test('an empty policy resolves to both default groups', () => {
    expect(resolveCredentialPolicyDefaults({})).toEqual({
      inFlight: DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
      concurrency: DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
    });
  });

  test('an empty in-flight group leaves every in-flight default standing', () => {
    expect(resolveCredentialPolicyDefaults({ inFlight: {} }).inFlight).toEqual(
      DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY,
    );
  });

  test('an empty concurrency group leaves every concurrency default standing', () => {
    expect(resolveCredentialPolicyDefaults({ concurrency: {} }).concurrency).toEqual(
      DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
    );
  });

  test('stating one group leaves the other group at its defaults', () => {
    const resolved = resolveCredentialPolicyDefaults({ inFlight: { maxDetails: 7 } });

    expect(resolved.concurrency).toEqual(DEFAULT_CREDENTIAL_CONCURRENCY_POLICY);
  });
});

describe('a stated credential policy field overrides its default', () => {
  test.each(inFlightKeys)('the in-flight %s is taken from the policy', (key) => {
    const resolved = resolveCredentialPolicyDefaults({ inFlight: inFlightWith(key, 11) });

    expect(resolved.inFlight[key]).toBe(11);
  });

  test.each(concurrencyKeys)('the concurrency %s is taken from the policy', (key) => {
    const resolved = resolveCredentialPolicyDefaults({ concurrency: concurrencyWith(key, 13) });

    expect(resolved.concurrency[key]).toBe(13);
  });

  test('a field left unstated keeps its default while its neighbor is overridden', () => {
    const resolved = resolveCredentialPolicyDefaults({ inFlight: { staleAfterMs: 1 } });

    expect(resolved.inFlight.staleAfterMs).toBe(1);
    expect(resolved.inFlight.snapshotIntervalMs).toBe(
      DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY.snapshotIntervalMs,
    );
  });
});

describe('a fully stated credential policy is returned as it was given', () => {
  test.prop([fc.integer({ min: 0, max: 1_000_000 })])(
    'every in-flight field round-trips unchanged',
    (value) => {
      const inFlight = statedInFlight(value);

      expect(resolveCredentialPolicyDefaults({ inFlight }).inFlight).toEqual(inFlight);
    },
  );

  test.prop([fc.integer({ min: 0, max: 1_000_000 })])(
    'every concurrency field round-trips unchanged',
    (value) => {
      const concurrency = statedConcurrency(value);

      expect(resolveCredentialPolicyDefaults({ concurrency }).concurrency).toEqual(concurrency);
    },
  );

  test.prop([fc.integer({ min: 0, max: 1_000 })])('resolving twice changes nothing', (value) => {
    const policy = { inFlight: statedInFlight(value), concurrency: statedConcurrency(value) };
    const once = resolveCredentialPolicyDefaults(policy);

    expect(resolveCredentialPolicyDefaults(policy)).toEqual(once);
  });
});
