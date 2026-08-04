import type { KeyCheckReport, KeyProviderId } from '@recompose/contracts';

import { keyProviderIdSchema } from '@recompose/contracts';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { IpcHandlers } from './dispatch';
import type { StoragePaths } from './storage-context';

import { loadAccountsFile } from '../storage/accounts-store';
import { getSecret } from '../storage/vault';
import { inVaultOrder } from '../storage/vault-order';
import { openVault } from './open-vault';
import { storagePathsFor } from './storage-context';
import { ipcFailure, storageFailure } from './storage-envelope';

export type KeyCheckIpcContext = {
  userDataPath: string;
  homeFolder: string;
  getCodec: () => SecretCodec;
  onCorrupt: (quarantinedPath: string) => void;
  probe: (provider: KeyProviderId, key: string) => Promise<KeyCheckReport>;
};

type KeyCheckIpcHandlers = Pick<IpcHandlers, 'accounts:check-key'>;

async function checkableRow(ctx: KeyCheckIpcContext, paths: StoragePaths, id: string) {
  const accounts = await loadAccountsFile(paths.accountsFile, ctx.onCorrupt);
  const row = accounts.accounts.find((candidate) => candidate.id === id);

  if (row === undefined || (row.kind !== 'api-key' && row.kind !== 'aggregator')) {
    return ipcFailure('storage-failed', `no key account is held under ${id}.`);
  }

  const provider = keyProviderIdSchema.safeParse(row.provider);

  if (!provider.success) {
    return ipcFailure(
      'validation-failed',
      `recompose has no key check for the provider "${row.provider}".`,
    );
  }

  return { ok: true as const, provider: provider.data, credentialRef: row.credentialRef };
}

async function decryptedSecret(ctx: KeyCheckIpcContext, paths: StoragePaths, id: string) {
  const row = await checkableRow(ctx, paths, id);

  if (!row.ok) {
    return row;
  }

  const opened = await openVault(paths.vaultFile, ctx.onCorrupt, ctx.homeFolder);

  if (!opened.ok) {
    return opened;
  }

  const secret = getSecret(opened.vault, ctx.getCodec(), row.credentialRef);

  if (secret === undefined) {
    return ipcFailure('storage-failed', 'the vault holds no secret for this account.');
  }

  return { ok: true as const, provider: row.provider, secret };
}

export function createKeyCheckIpcHandlers(ctx: KeyCheckIpcContext): KeyCheckIpcHandlers {
  const paths = storagePathsFor(ctx.userDataPath);

  return {
    'accounts:check-key': async (request) => {
      let gathered;

      try {
        gathered = await inVaultOrder(async () => decryptedSecret(ctx, paths, request.id));
      } catch (error) {
        return storageFailure(error, ctx.homeFolder);
      }

      if (!gathered.ok) {
        return gathered;
      }

      try {
        return { ok: true as const, value: await ctx.probe(gathered.provider, gathered.secret) };
      } catch (error) {
        return storageFailure(error, ctx.homeFolder);
      }
    },
  };
}
