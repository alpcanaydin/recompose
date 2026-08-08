import type { AccountTransportPolicy, SubscriptionProviderId } from '@recompose/contracts';

import type { ParsedSubscriptionCredential } from './credentials';
import type { RefreshFetch } from './refresh';

import { parseSubscriptionCredential } from './credentials';
import { credentialNeedsRefresh, refreshSubscriptionCredential } from './refresh';

type CredentialSpend = {
  provider: SubscriptionProviderId;
  accountId: string;
  credential: string;
  transportPolicy?: AccountTransportPolicy | undefined;
};

type CredentialRuntime = {
  refreshFetch: RefreshFetch;
  persist: (
    provider: SubscriptionProviderId,
    accountId: string,
    credential: string,
  ) => Promise<void>;
  now: () => number;
};

export async function refreshedAndPersisted(
  spend: CredentialSpend,
  blob: string,
  runtime: CredentialRuntime,
): Promise<{ blob: string; credential: ParsedSubscriptionCredential }> {
  const refreshed = await refreshSubscriptionCredential(
    spend.provider,
    blob,
    runtime.refreshFetch,
    runtime.now(),
    spend.transportPolicy,
  );

  await runtime.persist(spend.provider, spend.accountId, refreshed);

  const credential = parseSubscriptionCredential(spend.provider, refreshed);

  if (credential === null) {
    throw new Error('the refreshed subscription credential could not be read');
  }

  return { blob: refreshed, credential };
}

export function shouldRefreshUnauthorized(
  answer: Response,
  credential: ParsedSubscriptionCredential,
): boolean {
  return answer.status === 401 && credential.refreshToken !== undefined;
}

export async function readySubscriptionCredential(
  spend: CredentialSpend,
  runtime: CredentialRuntime,
): Promise<{ blob: string; credential: ParsedSubscriptionCredential }> {
  const credential = parseSubscriptionCredential(spend.provider, spend.credential);

  if (credential === null) {
    throw new Error('the subscription credential could not be read');
  }

  return credentialNeedsRefresh(credential, runtime.now(), spend.provider)
    ? refreshedAndPersisted(spend, spend.credential, runtime)
    : { blob: spend.credential, credential };
}
