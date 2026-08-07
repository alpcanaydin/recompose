import type { SubscriptionProviderId } from '@recompose/contracts';

import type { ParsedSubscriptionCredential } from './credentials';
import type { SubscriptionAttempt } from './intercepted-send';

import { retryAntigravityAttempt } from './antigravity-retry';
import { shouldRefreshUnauthorized } from './reach-credential';

type CompletionOptions = {
  attempt: SubscriptionAttempt;
  provider: SubscriptionProviderId;
  credential: ParsedSubscriptionCredential;
  wait?: ((milliseconds: number) => Promise<void>) | undefined;
  resend: () => Promise<SubscriptionAttempt>;
  refresh: () => Promise<SubscriptionAttempt>;
};

export async function completeSubscriptionAttempt(
  options: CompletionOptions,
): Promise<SubscriptionAttempt> {
  const retried = await retryAntigravityAttempt(
    options.attempt,
    options.provider,
    options.wait,
    options.resend,
  );

  if (retried.terminated || !shouldRefreshUnauthorized(retried.answer, options.credential)) {
    return retried;
  }

  return options.refresh();
}
