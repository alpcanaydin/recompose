import type { Account, CredentialedAccount, LocalAccount, LookCustody } from '@recompose/contracts';

import { keyProviderIdSchema } from '@recompose/contracts';

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
};

/** Where one account is reached and how the credential opening it is spelled, or why neither. */
export type ResolvedTarget =
  | { verdict: 'resolved'; providerOrigin: string; custody: LookCustody }
  | { verdict: 'missing-target' }
  | { verdict: 'missing-credential' };

function targetableIn(
  accounts: readonly Account[],
  accountId: string,
): CredentialedAccount | LocalAccount | undefined {
  const held = accounts.find((account) => account.id === accountId);

  return held === undefined || held.kind === 'subscription' ? undefined : held;
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
    : { custody: 'bearer', credential };
}

async function credentialedTarget(
  ctx: TargetCustodyContext,
  paths: StoragePaths,
  providerOrigin: string,
  account: CredentialedAccount,
): Promise<ResolvedTarget> {
  const credential = await inVaultOrder(async () => heldSecret(ctx, paths, account.credentialRef));

  return credential === undefined
    ? { verdict: 'missing-credential' }
    : { verdict: 'resolved', providerOrigin, custody: spelledFor(account, credential) };
}

/**
 * Where a stored account is reached, resolved against live storage for every ask.
 *
 * @summary The registry and the vault are read per ask rather than carried anywhere, so a key
 * removed or replaced between two asks takes effect on the next one. A subscription resolves to
 * nothing, because it authorizes a tool on this machine rather than a request recompose may send.
 * The secret lives in this call's scope and in whatever the caller hands the child, and nowhere
 * else. Storage that cannot be read carries out rather than reading as a refusal, because the lane
 * that owes an answer is the one place that turns a failure into one.
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

  return account.kind === 'local'
    ? { verdict: 'resolved', providerOrigin, custody: { custody: 'open' } }
    : credentialedTarget(ctx, paths, providerOrigin, account);
}
