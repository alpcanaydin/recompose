import { describe, expect, test } from 'vitest';

import type { ResolvedCredentialConcurrencyPolicy } from './credential-runtime-policy';

import {
  CredentialConcurrencyLimiter,
  DEFAULT_CREDENTIAL_CONCURRENCY_POLICY,
  resolveCredentialRuntimePolicy,
  validateCredentialConcurrencyLifecycle,
} from './credential-runtime-policy';

function concurrency(
  overrides: Partial<ResolvedCredentialConcurrencyPolicy>,
): ResolvedCredentialConcurrencyPolicy {
  return { ...DEFAULT_CREDENTIAL_CONCURRENCY_POLICY, ...overrides, lifecycleConfigRevision: 1 };
}

describe('the credential runtime policy refuses a lifecycle revision it cannot use', () => {
  test('an explicit zero lifecycle revision is refused', () => {
    expect(() =>
      resolveCredentialRuntimePolicy({ concurrency: { lifecycleConfigRevision: 0 } }),
    ).toThrow('lifecycle configuration revision must be positive when present');
  });

  test('a negative observation barrier revision is refused', () => {
    expect(() =>
      resolveCredentialRuntimePolicy({ concurrency: { observationBarrierRevision: -1 } }),
    ).toThrow('observation barrier revision must not be negative');
  });
});

describe('the credential runtime policy refuses concurrency values that contradict', () => {
  test('a release backoff below the flush interval is refused', () => {
    expect(() =>
      resolveCredentialRuntimePolicy({
        concurrency: { releaseFlushIntervalMs: 2_000, releaseMaxBackoffMs: 250 },
      }),
    ).toThrow('release backoff must cover the flush interval');
  });

  test('a busy retry maximum below the minimum is refused', () => {
    expect(() =>
      resolveCredentialRuntimePolicy({
        concurrency: { busyRetryMinMs: 1_000, busyRetryMaxMs: 250 },
      }),
    ).toThrow('retry maximum must cover the minimum');
  });

  test('a maximum limit below one is refused', () => {
    expect(() => resolveCredentialRuntimePolicy({ concurrency: { maxLimit: 0 } })).toThrow(
      'max limit must be between 1 and',
    );
  });

  test('a maximum limit above the hard bound is refused', () => {
    expect(() => resolveCredentialRuntimePolicy({ concurrency: { maxLimit: 1_000_001 } })).toThrow(
      'max limit must be between 1 and',
    );
  });

  test('a fractional cleanup interval is refused', () => {
    expect(() =>
      resolveCredentialRuntimePolicy({ concurrency: { cleanupIntervalMs: 1.5 } }),
    ).toThrow('cleanup interval must be a positive integer');
  });
});

describe('the credential runtime policy refuses in-flight bounds that contradict', () => {
  test('a stale interval under three snapshots is refused', () => {
    expect(() =>
      resolveCredentialRuntimePolicy({
        inFlight: { snapshotIntervalMs: 2_000, staleAfterMs: 3_000 },
      }),
    ).toThrow('stale interval must be at least three snapshots');
  });

  test('a part size below a kibibyte is refused', () => {
    expect(() => resolveCredentialRuntimePolicy({ inFlight: { maxPartBytes: 512 } })).toThrow(
      'invalid part bounds',
    );
  });

  test('a part count above the hard bound is refused', () => {
    expect(() => resolveCredentialRuntimePolicy({ inFlight: { maxPartCount: 65 } })).toThrow(
      'invalid part bounds',
    );
  });

  test('a revision smaller than one part is refused', () => {
    expect(() =>
      resolveCredentialRuntimePolicy({
        inFlight: { maxPartBytes: 1_048_576, maxRevisionBytes: 1_024 },
      }),
    ).toThrow('maximum revision bytes are outside hard bounds');
  });

  test('a revision that needs more parts than allowed is refused', () => {
    expect(() =>
      resolveCredentialRuntimePolicy({ inFlight: { maxPartBytes: 1_024, maxPartCount: 2 } }),
    ).toThrow('maximum revision bytes exceed part capacity');
  });

  test('a detail count above the hard bound is refused', () => {
    expect(() => resolveCredentialRuntimePolicy({ inFlight: { maxDetails: 10_001 } })).toThrow(
      'collection bounds are invalid',
    );
  });

  test('a string budget above the hard bound is refused', () => {
    expect(() => resolveCredentialRuntimePolicy({ inFlight: { maxStringBytes: 257 } })).toThrow(
      'maximum string bytes exceed hard bounds',
    );
  });
});

describe('the credential runtime policy refuses in-flight budgets out of bounds', () => {
  test('a staging retention of zero is refused', () => {
    expect(() => resolveCredentialRuntimePolicy({ inFlight: { stagingRetentionMs: 0 } })).toThrow(
      'staging retention must be a positive integer',
    );
  });

  test('an aggregate group count above the hard bound is refused', () => {
    expect(() =>
      resolveCredentialRuntimePolicy({ inFlight: { maxAggregateGroups: 100_001 } }),
    ).toThrow('collection bounds are invalid');
  });
});

describe('the concurrency lifecycle refuses a node that cannot outlive its agent', () => {
  test('a node heartbeat of zero is refused', () => {
    const lifecycle = () => {
      validateCredentialConcurrencyLifecycle(0, concurrency({}));
    };

    expect(lifecycle).toThrow('node heartbeat timeout must be a positive integer');
  });

  test('a node safety window inside the agent window is refused', () => {
    const lifecycle = () => {
      validateCredentialConcurrencyLifecycle(1_000, concurrency({}));
    };

    expect(lifecycle).toThrow('must exceed CPA heartbeat plus cancel bound');
  });

  test('a node safety window beyond the agent window is accepted', () => {
    const lifecycle = () => {
      validateCredentialConcurrencyLifecycle(20_000, concurrency({}));
    };

    expect(lifecycle).not.toThrow();
  });

  test('a reclaim grace that overflows the safe integer range is refused', () => {
    const policy = concurrency({ reclaimGraceMs: Number.MAX_SAFE_INTEGER });
    const lifecycle = () => {
      validateCredentialConcurrencyLifecycle(20_000, policy);
    };

    expect(lifecycle).toThrow('timing safety invariant overflows');
  });
});

describe('the credential concurrency limiter admits work up to its limit', () => {
  test('a blank credential id is refused', () => {
    const limiter = new CredentialConcurrencyLimiter(concurrency({}));

    expect(() => limiter.acquire('   ', 1)).toThrow('credential id must not be blank');
  });

  test('a limit below one is refused', () => {
    const limiter = new CredentialConcurrencyLimiter(concurrency({}));

    expect(() => limiter.acquire('credential-1', 0)).toThrow('limit must be between 1 and');
  });

  test('a limit above the policy maximum is refused', () => {
    const limiter = new CredentialConcurrencyLimiter(concurrency({ maxLimit: 4 }));

    expect(() => limiter.acquire('credential-1', 5)).toThrow('limit must be between 1 and');
  });

  test('work beyond the limit is turned away', () => {
    const limiter = new CredentialConcurrencyLimiter(concurrency({}));

    limiter.acquire('credential-1', 1);

    expect(limiter.acquire('credential-1', 1)).toBeUndefined();
  });

  test('releasing the last holder empties the credential', () => {
    const limiter = new CredentialConcurrencyLimiter(concurrency({}));
    const release = limiter.acquire('credential-1', 2);

    release?.();

    expect(limiter.active('credential-1')).toBe(0);
  });

  test('releasing one of several holders leaves the rest standing', () => {
    const limiter = new CredentialConcurrencyLimiter(concurrency({}));
    const first = limiter.acquire('credential-1', 2);

    limiter.acquire('credential-1', 2);
    first?.();

    expect(limiter.active('credential-1')).toBe(1);
  });

  test('releasing twice frees only one slot', () => {
    const limiter = new CredentialConcurrencyLimiter(concurrency({}));
    const release = limiter.acquire('credential-1', 2);

    limiter.acquire('credential-1', 2);
    release?.();
    release?.();

    expect(limiter.active('credential-1')).toBe(1);
  });

  test('a credential nobody holds is idle', () => {
    const limiter = new CredentialConcurrencyLimiter(concurrency({}));

    expect(limiter.active('credential-1')).toBe(0);
  });
});
