import type { AccountsDocument, IpcError, IpcRequest } from '@recompose/contracts';

import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { IpcHandlers } from './dispatch';

import { loadAccountsFile, saveAccountsFile } from '../storage/accounts-store';
import { listGatewayConfigs, saveGatewayConfig } from '../storage/gateway-store';
import { loadSettingsFile, saveSettingsFile } from '../storage/settings-store';
import {
  deleteSecret,
  loadVaultFile,
  saveVaultFile,
  setSecret,
  VaultNewerSchemaError,
} from '../storage/vault';

export type StorageIpcContext = {
  userDataPath: string;
  getCodec: () => SecretCodec;
  isEncryptionAvailable: () => boolean;
  onCorrupt: (quarantinedPath: string) => void;
};

type StoragePaths = {
  gatewaysDir: string;
  settingsFile: string;
  accountsFile: string;
  vaultFile: string;
};

function storagePathsFor(userDataPath: string): StoragePaths {
  return {
    gatewaysDir: join(userDataPath, 'gateways'),
    settingsFile: join(userDataPath, 'settings.json'),
    accountsFile: join(userDataPath, 'accounts.json'),
    vaultFile: join(userDataPath, 'vault.bin'),
  };
}

function failure(code: IpcError['code'], message: string) {
  return { ok: false as const, error: { code, message } };
}

function storageFailure(error: unknown) {
  return failure(
    'storage-failed',
    error instanceof Error ? error.message : 'storage operation failed',
  );
}

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
    return storageFailure(error);
  }
}

async function saveGateway(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  config: IpcRequest<'gateways:save'>,
) {
  try {
    await saveGatewayConfig(paths.gatewaysDir, config);

    return { ok: true as const, value: await listGatewayConfigs(paths.gatewaysDir, ctx.onCorrupt) };
  } catch (error) {
    return storageFailure(error);
  }
}

async function getSettings(ctx: StorageIpcContext, paths: StoragePaths) {
  try {
    return { ok: true as const, value: await loadSettingsFile(paths.settingsFile, ctx.onCorrupt) };
  } catch (error) {
    return storageFailure(error);
  }
}

async function saveSettings(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  settings: IpcRequest<'settings:save'>,
) {
  try {
    await saveSettingsFile(paths.settingsFile, settings);

    return { ok: true as const, value: await loadSettingsFile(paths.settingsFile, ctx.onCorrupt) };
  } catch (error) {
    return storageFailure(error);
  }
}

async function listAccounts(ctx: StorageIpcContext, paths: StoragePaths) {
  try {
    return { ok: true as const, value: await readAccounts(ctx, paths) };
  } catch (error) {
    return storageFailure(error);
  }
}

async function openVaultForWrite(ctx: StorageIpcContext, paths: StoragePaths) {
  try {
    return { ok: true as const, vault: await loadVaultFile(paths.vaultFile, ctx.onCorrupt) };
  } catch (error) {
    if (error instanceof VaultNewerSchemaError) {
      return failure('vault-newer-schema', error.message);
    }

    return storageFailure(error);
  }
}

async function connectAccount(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  request: IpcRequest<'accounts:connect'>,
) {
  if (!ctx.isEncryptionAvailable()) {
    return failure('vault-unavailable', 'OS secret encryption is unavailable');
  }

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
    return storageFailure(error);
  }
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

    const opened = await openVaultForWrite(ctx, paths);

    if (!opened.ok) {
      return opened;
    }

    await saveVaultFile(paths.vaultFile, deleteSecret(opened.vault, row.credentialRef));

    const updated = {
      ...accounts,
      accounts: accounts.accounts.filter((candidate) => candidate.id !== request.id),
    };

    await saveAccountsFile(paths.accountsFile, updated);

    return { ok: true as const, value: updated };
  } catch (error) {
    return storageFailure(error);
  }
}

export function createStorageIpcHandlers(ctx: StorageIpcContext): IpcHandlers {
  const paths = storagePathsFor(ctx.userDataPath);

  return {
    'gateways:list': () => listGateways(ctx, paths),
    'gateways:save': (config) => saveGateway(ctx, paths, config),
    'settings:get': () => getSettings(ctx, paths),
    'settings:save': (settings) => saveSettings(ctx, paths, settings),
    'accounts:list': () => listAccounts(ctx, paths),
    'accounts:connect': (request) => connectAccount(ctx, paths, request),
    'accounts:remove': (request) => removeAccount(ctx, paths, request),
  };
}
