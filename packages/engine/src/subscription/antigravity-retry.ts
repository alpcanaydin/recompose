import type { SubscriptionProviderId } from '@recompose/contracts';

import type { SubscriptionAttempt } from './intercepted-send';

import { antigravitySameTargetRetryDelay } from './antigravity-errors';

type RetryWait = ((milliseconds: number) => Promise<void>) | undefined;

async function defaultWait(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, milliseconds);
  });
}

async function waitForRetry(wait: RetryWait, milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return;

  await (wait ?? defaultWait)(milliseconds);
}

export async function retryAntigravityAttempt(
  attempt: SubscriptionAttempt,
  provider: SubscriptionProviderId,
  wait: RetryWait,
  resend: () => Promise<SubscriptionAttempt>,
): Promise<SubscriptionAttempt> {
  if (attempt.terminated || provider !== 'antigravity') return attempt;

  const delay = await antigravitySameTargetRetryDelay(attempt.answer);

  if (delay === null) return attempt;

  await waitForRetry(wait, delay);

  return resend();
}
