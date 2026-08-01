import type {
  AccountsDocument,
  GatewayConfig,
  IpcRequest,
  SettingsPatch,
  SubscriptionAccount,
} from '@recompose/contracts';

import { withSettingsPatch } from '@recompose/contracts';
import { randomUUID } from 'node:crypto';

import type { IpcHandlers } from './dispatch';

import { loadAccountsFile, saveAccountsFile } from '../storage/accounts-store';
import { listGatewayConfigs, saveGatewayConfig } from '../storage/gateway-store';
import { oneAtATime } from '../storage/one-at-a-time';
import {
  loadSettingsFile,
  saveSettingsFile,
  SettingsNewerSchemaError,
} from '../storage/settings-store';
import { deleteSecret, saveVaultFile, setSecret } from '../storage/vault';
import { inVaultOrder } from '../storage/vault-order';
import {
  openVaultForWrite,
  storagePathsFor,
  type StorageIpcContext,
  type StoragePaths,
} from './storage-context';
import { ipcFailure, openVault, storageFailure } from './storage-envelope';

async function readAccounts(
  ctx: StorageIpcContext,
  paths: StoragePaths,
): Promise<AccountsDocument> {
  return loadAccountsFile(paths.accountsFile, ctx.onCorrupt);
}

async function listGateways(ctx: StorageIpcContext, paths: StoragePaths) {
  try {
    return { ok: true as const, value: await listGatewayConfigs(paths.gatewaysDir, ctx.onCorrupt) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

function conflictWith(stored: readonly GatewayConfig[], saving: GatewayConfig) {
  const namesake = stored.find((one) => one.slug === saving.slug);

  if (namesake !== undefined) {
    return ipcFailure(
      'name-conflict',
      `Another gateway already holds the name "${namesake.displayName}".`,
    );
  }

  const holder = stored.find((one) => one.port === saving.port);

  if (holder !== undefined) {
    return ipcFailure('port-conflict', `${holder.slug} already holds this port.`);
  }

  return null;
}

async function saveGateway(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  config: IpcRequest<'gateways:save'>,
) {
  try {
    const stored = await listGatewayConfigs(paths.gatewaysDir, ctx.onCorrupt);
    const conflict = conflictWith(stored, config);

    if (conflict !== null) {
      return conflict;
    }

    await saveGatewayConfig(paths.gatewaysDir, config);
    ctx.startGateway({
      slug: config.slug,
      displayName: config.displayName,
      port: config.port,
    });

    return { ok: true as const, value: await listGatewayConfigs(paths.gatewaysDir, ctx.onCorrupt) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
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

async function connectAccount(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  request: IpcRequest<'accounts:connect'>,
) {
  const opened = await openVaultForWrite(ctx, paths);

  if (!opened.ok) {
    return opened;
  }

  try {
    const credentialRef = `cred-${randomUUID()}`;
    const account = {
      id: `acc-${randomUUID()}`,
      provider: request.provider,
      kind: request.kind,
      label: request.label,
      credentialRef,
    };

    await saveVaultFile(
      paths.vaultFile,
      setSecret(opened.vault, ctx.getCodec(), credentialRef, request.secret),
    );

    const accounts = await readAccounts(ctx, paths);
    const updated = { ...accounts, accounts: [...accounts.accounts, account] };

    await saveAccountsFile(paths.accountsFile, updated);

    return { ok: true as const, value: updated };
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

    const updated = {
      ...accounts,
      accounts: accounts.accounts.filter((candidate) => candidate.id !== request.id),
    };

    if (row.kind === 'subscription') {
      await ctx.releaseSubscription(row, sameProviderIds(updated, row.provider));
    } else {
      const opened = await openVault(paths.vaultFile, ctx.onCorrupt, ctx.homeFolder);

      if (!opened.ok) {
        return opened;
      }

      await saveVaultFile(paths.vaultFile, deleteSecret(opened.vault, row.credentialRef));
    }

    await saveAccountsFile(paths.accountsFile, updated);

    return { ok: true as const, value: updated };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

export type StorageIpcHandlers = Pick<
  IpcHandlers,
  | 'gateways:list'
  | 'gateways:save'
  | 'settings:get'
  | 'settings:save'
  | 'accounts:list'
  | 'accounts:connect'
  | 'accounts:remove'
>;

export function createStorageIpcHandlers(ctx: StorageIpcContext): StorageIpcHandlers {
  const paths = storagePathsFor(ctx.userDataPath);
  const inSaveOrder = oneAtATime();

  return {
    'gateways:list': async () => listGateways(ctx, paths),
    'gateways:save': async (config) => inSaveOrder(async () => saveGateway(ctx, paths, config)),
    'settings:get': async () => getSettings(ctx, paths),
    'settings:save': async (settings) => saveSettings(ctx, paths, settings),
    'accounts:list': async () => listAccounts(ctx, paths),
    'accounts:connect': async (request) =>
      inVaultOrder(async () => connectAccount(ctx, paths, request)),
    'accounts:remove': async (request) =>
      inVaultOrder(async () => removeAccount(ctx, paths, request)),
  };
}
