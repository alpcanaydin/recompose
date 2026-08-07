import { describe, expect, it } from 'vitest';

import {
  antigravityRetryDelayMilliseconds,
  antigravitySameTargetRetryDelay,
  normalizeAntigravityError,
} from './antigravity-errors';

describe('Antigravity retry delay parsing', () => {
  it('should parse a human-readable reset duration', () => {
    const body = JSON.stringify({
      error: {
        message: 'You have exhausted your capacity. Your quota will reset after 1h43m56s.',
      },
    });

    expect(antigravityRetryDelayMilliseconds(body)).toBe(6_236_000);
  });

  it('should parse Google RetryInfo seconds', () => {
    const body = rateLimitBody('0.479417207s');

    expect(antigravityRetryDelayMilliseconds(body)).toBeCloseTo(479.417207);
  });
});

describe('Antigravity same-target retry decisions', () => {
  it('should retry an unclassified soft 429 once after 500 ms', async () => {
    const response = Response.json(
      { error: { status: 'RESOURCE_EXHAUSTED', message: 'Resource has been exhausted' } },
      { status: 429 },
    );

    await expect(antigravitySameTargetRetryDelay(response)).resolves.toBe(500);
  });

  it('should pad a short structured rate limit', async () => {
    const response = new Response(rateLimitBody('0.479417207s'), { status: 429 });

    await expect(antigravitySameTargetRetryDelay(response)).resolves.toBeCloseTo(1_279.417207);
  });

  it('should leave longer rate limits for a future router decision', async () => {
    const response = new Response(rateLimitBody('10s'), { status: 429 });

    await expect(antigravitySameTargetRetryDelay(response)).resolves.toBeNull();
  });

  it('should not retry explicit quota exhaustion', async () => {
    const response = new Response(reasonBody('QUOTA_EXHAUSTED'), { status: 429 });

    await expect(antigravitySameTargetRetryDelay(response)).resolves.toBeNull();
  });
});

describe('Antigravity downstream retry metadata', () => {
  it('should expose a structured retry delay without changing the body', async () => {
    const body = rateLimitBody('4.2s');
    const answer = await normalizeAntigravityError(new Response(body, { status: 429 }));

    expect(answer.headers.get('retry-after')).toBe('5');
    await expect(answer.text()).resolves.toBe(body);
  });
});

// Helpers

function rateLimitBody(retryDelay: string): string {
  return JSON.stringify({
    error: {
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason: 'RATE_LIMIT_EXCEEDED',
        },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay },
      ],
    },
  });
}

function reasonBody(reason: string): string {
  return JSON.stringify({
    error: {
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason,
        },
      ],
    },
  });
}
