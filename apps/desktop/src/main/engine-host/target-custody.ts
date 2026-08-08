import type {
  Account,
  CredentialedAccount,
  LookCustody,
  ProviderModelPolicy,
  SubscriptionAccount,
} from '@recompose/contracts';

import { keyProviderIdSchema, normalizeProviderKey } from '@recompose/contracts';

import type { StoragePaths } from '../ipc/storage-context';
import type { SecretCodec } from '../storage/safe-storage-codec';

import { openVault } from '../ipc/open-vault';
import { storagePathsFor } from '../ipc/storage-context';
import { loadAccountsFile } from '../storage/accounts-store';
import { getSecret } from '../storage/vault';
import { inVaultOrder } from '../storage/vault-order';
import { providerOriginOf } from './provider-origin';

export type TargetCustodyContext = {
  userDataPath: string;
  /** The home directory this process runs under, so no account name reaches a log line. */
  homeFolder: string;
  getCodec: () => SecretCodec;
  onCorrupt: (quarantinedPath: string) => void;
  readSubscriptionCredential: (
    provider: SubscriptionAccount['provider'],
    accountId: string,
  ) => Promise<string | null>;
};

/** Where one account is reached and how the credential opening it is spelled, or why neither. */
export type ResolvedTarget =
  | {
      verdict: 'resolved';
      providerOrigin: string;
      custody: LookCustody;
      modelPolicy?: ProviderModelPolicy;
    }
  | { verdict: 'missing-target' }
  | { verdict: 'missing-credential' };

function targetableIn(accounts: readonly Account[], accountId: string): Account | undefined {
  return accounts.find((account) => account.id === accountId);
}

async function subscriptionTarget(
  ctx: TargetCustodyContext,
  providerOrigin: string,
  account: SubscriptionAccount,
  modelPolicy: ProviderModelPolicy | undefined,
): Promise<ResolvedTarget> {
  const credential = await ctx.readSubscriptionCredential(account.provider, account.id);

  return credential === null
    ? { verdict: 'missing-credential' }
    : {
        verdict: 'resolved',
        providerOrigin,
        custody: {
          custody: 'subscription',
          provider: account.provider,
          accountId: account.id,
          credential,
          ...(account.transportPolicy === undefined
            ? {}
            : { transportPolicy: account.transportPolicy }),
        },
        ...(modelPolicy === undefined ? {} : { modelPolicy }),
      };
}

async function heldSecret(
  ctx: TargetCustodyContext,
  paths: StoragePaths,
  credentialRef: string,
): Promise<string | undefined> {
  const opened = await openVault(paths.vaultFile, ctx.onCorrupt, ctx.homeFolder);

  if (!opened.ok) {
    console.error(
      `recompose could not open the vault to reach a target, so the turn is refused: ${opened.error.message}`,
    );

    return undefined;
  }

  return getSecret(opened.vault, ctx.getCodec(), credentialRef);
}

function spelledFor(account: CredentialedAccount, credential: string): LookCustody {
  const firstParty = keyProviderIdSchema.safeParse(account.provider);

  return firstParty.success
    ? { custody: 'provider-key', provider: firstParty.data, credential }
    : { custody: 'bearer', provider: account.provider, credential };
}

async function credentialedTarget(
  ctx: TargetCustodyContext,
  paths: StoragePaths,
  providerOrigin: string,
  account: CredentialedAccount,
  modelPolicy: ProviderModelPolicy | undefined,
): Promise<ResolvedTarget> {
  const credential = await inVaultOrder(async () => heldSecret(ctx, paths, account.credentialRef));

  return credential === undefined
    ? { verdict: 'missing-credential' }
    : {
        verdict: 'resolved',
        providerOrigin,
        custody: spelledFor(account, credential),
        ...(modelPolicy === undefined ? {} : { modelPolicy }),
      };
}

function modelPolicyFor(
  provider: string,
  policies: Readonly<Record<string, ProviderModelPolicy>> | undefined,
): ProviderModelPolicy | undefined {
  return policies?.[normalizeProviderKey(provider)];
}

function resolvedAccountTarget(
  ctx: TargetCustodyContext,
  paths: StoragePaths,
  providerOrigin: string,
  account: Account,
  modelPolicy: ProviderModelPolicy | undefined,
): Promise<ResolvedTarget> | ResolvedTarget {
  if (account.kind === 'local') {
    return {
      verdict: 'resolved',
      providerOrigin,
      custody: { custody: 'open' },
      ...(modelPolicy === undefined ? {} : { modelPolicy }),
    };
  }

  return account.kind === 'subscription'
    ? subscriptionTarget(ctx, providerOrigin, account, modelPolicy)
    : credentialedTarget(ctx, paths, providerOrigin, account, modelPolicy);
}

/**
 * Where a stored account is reached, resolved against live storage for every ask.
 *
 * @summary The registry and the vault are read per ask rather than carried anywhere, so a key
 * removed or replaced between two asks takes effect on the next one. The secret lives in this
 * call's scope and in whatever the caller hands the child, and nowhere else. Storage that cannot
 * be read carries out rather than reading as a refusal, because the lane that owes an answer is
 * the one place that turns a failure into one.
 */
export async function resolveTargetCustody(
  ctx: TargetCustodyContext,
  accountId: string,
): Promise<ResolvedTarget> {
  const paths = storagePathsFor(ctx.userDataPath);
  const registry = await loadAccountsFile(paths.accountsFile, ctx.onCorrupt);
  const account = targetableIn(registry.accounts, accountId);

  if (account === undefined) {
    return { verdict: 'missing-target' };
  }

  const providerOrigin = providerOriginOf(account);

  if (providerOrigin === undefined) {
    return { verdict: 'missing-target' };
  }

  const modelPolicy = modelPolicyFor(account.provider, registry.modelPolicies);

  return resolvedAccountTarget(ctx, paths, providerOrigin, account, modelPolicy);
}
