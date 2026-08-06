import type {
  Account,
  AccountsDocument,
  IpcRequest,
  SettingsPatch,
  SubscriptionAccount,
} from '@recompose/contracts';

import { withSettingsPatch } from '@recompose/contracts';

import type { IpcHandlers } from './dispatch';

import { amendAccountsFile, loadAccountsFile } from '../storage/accounts-store';
import { oneAtATime } from '../storage/one-at-a-time';
import {
  loadSettingsFile,
  saveSettingsFile,
  SettingsNewerSchemaError,
} from '../storage/settings-store';
import { deleteSecret, saveVaultFile } from '../storage/vault';
import { inVaultOrder } from '../storage/vault-order';
import { connectAccount } from './connect-account';
import { createGatewayStorageHandlers } from './gateway-storage-ipc';
import { openVault } from './open-vault';
import { storagePathsFor, type StorageIpcContext, type StoragePaths } from './storage-context';
import { ipcFailure, storageFailure } from './storage-envelope';

async function readAccounts(
  ctx: StorageIpcContext,
  paths: StoragePaths,
): Promise<AccountsDocument> {
  return loadAccountsFile(paths.accountsFile, ctx.onCorrupt);
}

function settingsFailure(error: unknown, home: string) {
  if (error instanceof SettingsNewerSchemaError) {
    return ipcFailure('settings-newer-schema', error.message);
  }

  return storageFailure(error, home);
}

async function getSettings(ctx: StorageIpcContext, paths: StoragePaths) {
  try {
    const stored = await loadSettingsFile(paths.settingsFile, ctx.onCorrupt);

    return { ok: true as const, value: { ...stored, launchAtLogin: ctx.readLoginItem() } };
  } catch (error) {
    return settingsFailure(error, ctx.homeFolder);
  }
}

async function writeSettings(ctx: StorageIpcContext, paths: StoragePaths, patch: SettingsPatch) {
  const previous = await loadSettingsFile(paths.settingsFile, ctx.onCorrupt);

  await saveSettingsFile(paths.settingsFile, withSettingsPatch(previous, patch));

  return { stored: await loadSettingsFile(paths.settingsFile, ctx.onCorrupt) };
}

async function saveSettings(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  patch: IpcRequest<'settings:save'>,
) {
  let written;

  try {
    written = await writeSettings(ctx, paths, patch);
  } catch (error) {
    return settingsFailure(error, ctx.homeFolder);
  }

  ctx.applySettings(written.stored, patch.launchAtLogin);

  return { ok: true as const, value: { ...written.stored, launchAtLogin: ctx.readLoginItem() } };
}

async function listAccounts(ctx: StorageIpcContext, paths: StoragePaths) {
  try {
    return { ok: true as const, value: await readAccounts(ctx, paths) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

function sameProviderIds(accounts: AccountsDocument, provider: SubscriptionAccount['provider']) {
  const ids: string[] = [];

  for (const candidate of accounts.accounts) {
    if (candidate.kind === 'subscription' && candidate.provider === provider) {
      ids.push(candidate.id);
    }
  }

  return ids;
}

async function releaseSubscriptionRow(
  ctx: StorageIpcContext,
  row: SubscriptionAccount,
  updated: AccountsDocument,
): Promise<{ ok: true } | ReturnType<typeof ipcFailure>> {
  const released = await ctx.releaseSubscription(row, sameProviderIds(updated, row.provider));

  if (!released.ok) {
    return ipcFailure(released.code, released.message);
  }

  return { ok: true as const };
}

async function releaseKeyRow(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  row: { credentialRef: string },
) {
  const opened = await openVault(paths.vaultFile, ctx.onCorrupt, ctx.homeFolder);

  if (!opened.ok) {
    return opened;
  }

  await saveVaultFile(paths.vaultFile, deleteSecret(opened.vault, row.credentialRef));

  return { ok: true as const };
}

async function releaseWhatTheRowHeld(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  row: Account,
  survivors: AccountsDocument,
) {
  if (row.kind === 'subscription') {
    return releaseSubscriptionRow(ctx, row, survivors);
  }

  if (row.kind === 'local') {
    return { ok: true as const };
  }

  return releaseKeyRow(ctx, paths, row);
}

async function removeAccount(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  request: IpcRequest<'accounts:remove'>,
) {
  try {
    const accounts = await readAccounts(ctx, paths);
    const row = accounts.accounts.find((candidate) => candidate.id === request.id);

    if (row === undefined) {
      return { ok: true as const, value: accounts };
    }

    const survivors = {
      ...accounts,
      accounts: accounts.accounts.filter((candidate) => candidate.id !== request.id),
    };

    const released = await releaseWhatTheRowHeld(ctx, paths, row, survivors);

    if (!released.ok) {
      return released;
    }

    const updated = await amendAccountsFile(paths.accountsFile, ctx.onCorrupt, (fresh) => ({
      ...fresh,
      accounts: fresh.accounts.filter((candidate) => candidate.id !== request.id),
    }));

    return { ok: true as const, value: updated };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

export type StorageIpcHandlers = Pick<
  IpcHandlers,
  | 'gateways:list'
  | 'gateways:save'
  | 'gateways:update'
  | 'settings:get'
  | 'settings:save'
  | 'accounts:list'
  | 'accounts:connect'
  | 'accounts:remove'
>;

export function createStorageIpcHandlers(ctx: StorageIpcContext): StorageIpcHandlers {
  const paths = storagePathsFor(ctx.userDataPath);

  return {
    ...createGatewayStorageHandlers(ctx, paths, oneAtATime()),
    'settings:get': async () => getSettings(ctx, paths),
    'settings:save': async (settings) => saveSettings(ctx, paths, settings),
    'accounts:list': async () => listAccounts(ctx, paths),
    'accounts:connect': async (request) =>
      inVaultOrder(async () => connectAccount(ctx, paths, request)),
    'accounts:remove': async (request) =>
      inVaultOrder(async () => removeAccount(ctx, paths, request)),
  };
}
