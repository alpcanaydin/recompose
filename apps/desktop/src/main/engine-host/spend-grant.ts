import type {
  Account,
  CredentialedAccount,
  LocalAccount,
  SpendGrant,
  Target,
} from '@recompose/contracts';

import type { StoragePaths } from '../ipc/storage-context';
import type { SecretCodec } from '../storage/safe-storage-codec';

import { openVault } from '../ipc/open-vault';
import { storagePathsFor } from '../ipc/storage-context';
import { loadAccountsFile } from '../storage/accounts-store';
import { listGatewayConfigs } from '../storage/gateway-store';
import { getSecret } from '../storage/vault';
import { inVaultOrder } from '../storage/vault-order';
import { providerOriginOf } from './provider-origin';

export type SpendGrantContext = {
  userDataPath: string;
  /** The home directory this process runs under, so no account name reaches a log line. */
  homeFolder: string;
  getCodec: () => SecretCodec;
  onCorrupt: (quarantinedPath: string) => void;
};

async function storedTarget(
  paths: StoragePaths,
  onCorrupt: (quarantinedPath: string) => void,
  slug: string,
  virtualModel: string,
): Promise<Target | undefined> {
  const stored = await listGatewayConfigs(paths.gatewaysDir, onCorrupt);
  const serving = stored.find((config) => config.slug === slug);

  return serving?.virtualModels.find((model) => model.id === virtualModel)?.target;
}

function spendableIn(
  accounts: readonly Account[],
  accountId: string,
): CredentialedAccount | LocalAccount | undefined {
  const held = accounts.find((account) => account.id === accountId);

  return held === undefined || held.kind === 'subscription' ? undefined : held;
}

async function heldSecret(
  ctx: SpendGrantContext,
  paths: StoragePaths,
  credentialRef: string,
): Promise<string | undefined> {
  const opened = await openVault(paths.vaultFile, ctx.onCorrupt, ctx.homeFolder);

  return opened.ok ? getSecret(opened.vault, ctx.getCodec(), credentialRef) : undefined;
}

async function credentialedGrant(
  ctx: SpendGrantContext,
  paths: StoragePaths,
  providerOrigin: string,
  credentialRef: string,
): Promise<SpendGrant> {
  const credential = await inVaultOrder(async () => heldSecret(ctx, paths, credentialRef));

  return credential === undefined
    ? { verdict: 'missing-credential' }
    : { verdict: 'resolved', providerOrigin, spend: { custody: 'credentialed', credential } };
}

async function grantAgainst(
  ctx: SpendGrantContext,
  paths: StoragePaths,
  account: CredentialedAccount | LocalAccount,
): Promise<SpendGrant> {
  const providerOrigin = providerOriginOf(account);

  if (providerOrigin === undefined) {
    return { verdict: 'missing-target' };
  }

  if (account.kind === 'local') {
    return { verdict: 'resolved', providerOrigin, spend: { custody: 'open' } };
  }

  return credentialedGrant(ctx, paths, providerOrigin, account.credentialRef);
}

/**
 * What one turn may be spent against, resolved against live storage for every request.
 *
 * @summary The registry and the vault are read per request rather than carried in the start
 * directive, so a key removed or replaced between two turns takes effect on the next one. The
 * secret lives in this call's scope and in the message that answers the child, and nowhere else.
 * Storage that cannot be read carries out rather than reading as a refusal, because the lane that
 * owes the child an answer is the one place that turns a failure into one.
 */
export async function resolveSpendGrant(
  ctx: SpendGrantContext,
  slug: string,
  virtualModel: string,
): Promise<SpendGrant> {
  const paths = storagePathsFor(ctx.userDataPath);
  const target = await storedTarget(paths, ctx.onCorrupt, slug, virtualModel);

  if (target === undefined) {
    return { verdict: 'missing-target' };
  }

  const registry = await loadAccountsFile(paths.accountsFile, ctx.onCorrupt);
  const account = spendableIn(registry.accounts, target.accountId);

  return account === undefined ? { verdict: 'missing-target' } : grantAgainst(ctx, paths, account);
}
