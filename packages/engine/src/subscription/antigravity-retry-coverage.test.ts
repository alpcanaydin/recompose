import { describe, expect, it } from 'vitest';

import type { SubscriptionAttempt } from './intercepted-send';

import { retryAntigravityAttempt } from './antigravity-retry';

function rateLimited(retryDelay: string): SubscriptionAttempt {
  const body = JSON.stringify({
    error: {
      status: 'RESOURCE_EXHAUSTED',
      details: [
        { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'RATE_LIMIT_EXCEEDED' },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay },
      ],
    },
  });

  return { answer: new Response(body, { status: 429 }), terminated: false };
}

async function resent(): Promise<SubscriptionAttempt> {
  await Promise.resolve();

  return { answer: new Response('second try', { status: 200 }), terminated: false };
}

describe('retrying the same Antigravity target', () => {
  it('should resend at once when the rate limit already elapsed', async () => {
    const started = Date.now();

    const retried = await retryAntigravityAttempt(
      rateLimited('0s'),
      'antigravity',
      undefined,
      resent,
    );

    await expect(retried.answer.text()).resolves.toBe('second try');
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('should sleep on its own clock when the caller supplies none', async () => {
    const started = Date.now();

    const retried = await retryAntigravityAttempt(
      rateLimited('0.005s'),
      'antigravity',
      undefined,
      resent,
    );

    expect(retried.answer.status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(800);
  });
});
