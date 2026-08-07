import type { SubscriptionProviderId } from '@recompose/contracts';

import type { ClaudeProfile } from './provider-transport';

import { parseSubscriptionCredential, withClaudeCredentialIdentity } from './credentials';

type ReadyCredential = {
  blob: string;
  credential: NonNullable<ReturnType<typeof parseSubscriptionCredential>>;
};

type SubscriptionSpend = {
  provider: SubscriptionProviderId;
  accountId: string;
};

type ClaudeIdentityRuntime = {
  persist: (
    provider: SubscriptionProviderId,
    accountId: string,
    credential: string,
  ) => Promise<void>;
  newClaudeDeviceId: () => string;
  fetchClaudeProfile: (accessToken: string) => Promise<ClaudeProfile>;
};

function claudeIdentityOf(credential: ReadyCredential['credential']) {
  const deviceId = credential.deviceIds?.[0];

  return credential.accountUuid === undefined || deviceId === undefined
    ? undefined
    : { accountUuid: credential.accountUuid, deviceId };
}

async function accountUuidFor(
  credential: ReadyCredential['credential'],
  runtime: ClaudeIdentityRuntime,
): Promise<string> {
  if (credential.accountUuid !== undefined) return credential.accountUuid;

  return (await runtime.fetchClaudeProfile(credential.accessToken)).account.uuid;
}

function deviceIdFor(
  credential: ReadyCredential['credential'],
  runtime: ClaudeIdentityRuntime,
): string {
  return credential.deviceIds?.[0] ?? runtime.newClaudeDeviceId();
}

export async function readyClaudeIdentity(
  spend: SubscriptionSpend,
  ready: ReadyCredential,
  runtime: ClaudeIdentityRuntime,
): Promise<ReadyCredential> {
  if (spend.provider !== 'anthropic' || claudeIdentityOf(ready.credential) !== undefined) {
    return ready;
  }

  const accountUuid = await accountUuidFor(ready.credential, runtime);
  const deviceId = deviceIdFor(ready.credential, runtime);
  const blob = withClaudeCredentialIdentity(ready.blob, accountUuid, deviceId);

  await runtime.persist(spend.provider, spend.accountId, blob);

  const credential = parseSubscriptionCredential(spend.provider, blob);

  if (credential === null)
    throw new Error('the identified subscription credential could not be read');

  return { blob, credential };
}
