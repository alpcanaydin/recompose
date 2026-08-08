import type { SubscriptionProviderId } from '@recompose/contracts';

import type { JsonObject } from '../gateway-wire';
import type { ParsedSubscriptionCredential } from './credentials';
import type { SubscriptionAttempt } from './intercepted-send';

import { retryAntigravityAttempt } from './antigravity-retry';
import { claudeFailureScope } from './claude-fast-failure';
import { shouldRefreshUnauthorized } from './reach-credential';

type CompletionOptions = {
  attempt: SubscriptionAttempt;
  provider: SubscriptionProviderId;
  credential: ParsedSubscriptionCredential;
  requestBody: JsonObject;
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
  const classified = await classifiedAttempt(retried, options);

  if (
    classified.terminated ||
    classified.failureScope === 'request' ||
    !shouldRefreshUnauthorized(classified.answer, options.credential)
  ) {
    return classified;
  }

  return options.refresh();
}

async function classifiedAttempt(
  attempt: SubscriptionAttempt,
  options: CompletionOptions,
): Promise<SubscriptionAttempt> {
  if (attempt.terminated || options.provider !== 'anthropic' || attempt.answer.ok) return attempt;

  const failureScope = await claudeFailureScope(
    attempt.answer.status,
    attempt.answer,
    options.requestBody,
  );

  return { ...attempt, failureScope };
}
