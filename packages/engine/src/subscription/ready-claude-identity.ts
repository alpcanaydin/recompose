import type { AccountTransportPolicy, SubscriptionProviderId } from '@recompose/contracts';

import type { ClaudeProfile } from './provider-transport';

import { parseSubscriptionCredential, withClaudeCredentialIdentity } from './credentials';

type ReadyCredential = {
  blob: string;
  credential: NonNullable<ReturnType<typeof parseSubscriptionCredential>>;
};

type SubscriptionSpend = {
  provider: SubscriptionProviderId;
  accountId: string;
  transportPolicy?: AccountTransportPolicy | undefined;
};

type ClaudeIdentityRuntime = {
  persist: (
    provider: SubscriptionProviderId,
    accountId: string,
    credential: string,
  ) => Promise<void>;
  newClaudeDeviceId: () => string;
  fetchClaudeProfile: (
    accessToken: string,
    policy?: AccountTransportPolicy,
  ) => Promise<ClaudeProfile>;
};

type ClaudeIdentity = { accountUuid: string; deviceId: string };

const initializedIdentities = new Map<
  string,
  { accessToken: string; identity: Promise<ClaudeIdentity> }
>();

function claudeIdentityOf(credential: ReadyCredential['credential']): ClaudeIdentity | undefined {
  const deviceId = credential.deviceIds?.[0];

  return credential.accountUuid === undefined || deviceId === undefined
    ? undefined
    : { accountUuid: credential.accountUuid, deviceId };
}

async function initializeClaudeIdentity(
  spend: SubscriptionSpend,
  ready: ReadyCredential,
  runtime: ClaudeIdentityRuntime,
): Promise<ClaudeIdentity> {
  const accountUuid = await accountUuidFor(ready.credential, runtime, spend.transportPolicy);
  const deviceId = deviceIdFor(ready.credential, runtime);
  const blob = withClaudeCredentialIdentity(ready.blob, accountUuid, deviceId);

  await runtime.persist(spend.provider, spend.accountId, blob);

  return { accountUuid, deviceId };
}

async function sharedClaudeIdentity(
  spend: SubscriptionSpend,
  ready: ReadyCredential,
  runtime: ClaudeIdentityRuntime,
): Promise<ClaudeIdentity> {
  const standing = initializedIdentities.get(spend.accountId);

  if (standing?.accessToken === ready.credential.accessToken) return standing.identity;

  const identity = initializeClaudeIdentity(spend, ready, runtime).catch((failure: unknown) => {
    if (initializedIdentities.get(spend.accountId)?.accessToken === ready.credential.accessToken) {
      initializedIdentities.delete(spend.accountId);
    }

    throw failure;
  });

  initializedIdentities.set(spend.accountId, {
    accessToken: ready.credential.accessToken,
    identity,
  });

  return identity;
}

async function accountUuidFor(
  credential: ReadyCredential['credential'],
  runtime: ClaudeIdentityRuntime,
  policy?: AccountTransportPolicy,
): Promise<string> {
  if (credential.accountUuid !== undefined) return credential.accountUuid;

  return (await runtime.fetchClaudeProfile(credential.accessToken, policy)).account.uuid;
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
  if (spend.provider !== 'anthropic') {
    return ready;
  }

  if (
    claudeIdentityOf(ready.credential) !== undefined &&
    ready.credential.deviceMigrationNeeded !== true
  )
    return ready;

  const { accountUuid, deviceId } = await sharedClaudeIdentity(spend, ready, runtime);
  const blob = withClaudeCredentialIdentity(ready.blob, accountUuid, deviceId);

  const credential = parseSubscriptionCredential(spend.provider, blob);

  if (credential === null)
    throw new Error('the identified subscription credential could not be read');

  return { blob, credential };
}
