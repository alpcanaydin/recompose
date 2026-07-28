import type { AccountsDocument, IpcRequest } from '@recompose/contracts';

import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { IpcHandlers } from './dispatch';

import {
  GATEWAY_TOKEN_REF,
  gatewayTokenStorageState,
  maskGatewayToken,
  mintGatewayToken,
} from '../settings/gateway-token';
import { loadAccountsFile, saveAccountsFile } from '../storage/accounts-store';
import { listGatewayConfigs, saveGatewayConfig } from '../storage/gateway-store';
import { loadSettingsFile, saveSettingsFile } from '../storage/settings-store';
import { deleteSecret, getSecret, saveVaultFile, setSecret } from '../storage/vault';
import { ipcFailure, openVault, storageFailure } from './storage-envelope';

export type StorageIpcContext = {
  userDataPath: string;
  getCodec: () => SecretCodec;
  isEncryptionAvailable: () => boolean;
  onCorrupt: (quarantinedPath: string) => void;
  writeClipboard: (text: string) => void;
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
  if (!ctx.isEncryptionAvailable()) {
    return ipcFailure('vault-unavailable', 'OS secret encryption is unavailable');
  }

  return openVault(paths.vaultFile, ctx.onCorrupt);
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

    const opened = await openVault(paths.vaultFile, ctx.onCorrupt);

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

async function readGatewayToken(ctx: StorageIpcContext, paths: StoragePaths) {
  const opened = await openVault(paths.vaultFile, ctx.onCorrupt);

  if (!opened.ok) {
    return opened;
  }

  try {
    return { ok: true as const, token: getSecret(opened.vault, ctx.getCodec(), GATEWAY_TOKEN_REF) };
  } catch (error) {
    return storageFailure(error);
  }
}

async function getGatewayTokenStatus(ctx: StorageIpcContext, paths: StoragePaths) {
  const storage = gatewayTokenStorageState(
    ctx.isEncryptionAvailable(),
    ctx.getCodec().isPlaintextFallback,
  );

  if (storage === 'unavailable') {
    return { ok: true as const, value: { masked: null, storage } };
  }

  const read = await readGatewayToken(ctx, paths);

  if (!read.ok) {
    return read;
  }

  const masked = read.token === undefined ? null : maskGatewayToken(read.token);

  return { ok: true as const, value: { masked, storage } };
}

async function mintGatewayTokenIntoVault(ctx: StorageIpcContext, paths: StoragePaths) {
  const opened = await openVaultForWrite(ctx, paths);

  if (!opened.ok) {
    return opened;
  }

  try {
    const token = mintGatewayToken();
    const codec = ctx.getCodec();

    await saveVaultFile(paths.vaultFile, setSecret(opened.vault, codec, GATEWAY_TOKEN_REF, token));

    return {
      ok: true as const,
      value: {
        masked: maskGatewayToken(token),
        storage: gatewayTokenStorageState(true, codec.isPlaintextFallback),
      },
    };
  } catch (error) {
    return storageFailure(error);
  }
}

async function copyGatewayTokenToClipboard(ctx: StorageIpcContext, paths: StoragePaths) {
  const read = await readGatewayToken(ctx, paths);

  if (!read.ok) {
    return read;
  }

  if (read.token === undefined) {
    return ipcFailure('token-missing', 'the vault holds no gateway token to copy');
  }

  ctx.writeClipboard(read.token);

  return { ok: true as const, value: undefined };
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
  | 'gateway-token:status'
  | 'gateway-token:mint'
  | 'gateway-token:copy'
>;

export function createStorageIpcHandlers(ctx: StorageIpcContext): StorageIpcHandlers {
  const paths = storagePathsFor(ctx.userDataPath);

  return {
    'gateways:list': async () => listGateways(ctx, paths),
    'gateways:save': async (config) => saveGateway(ctx, paths, config),
    'settings:get': async () => getSettings(ctx, paths),
    'settings:save': async (settings) => saveSettings(ctx, paths, settings),
    'accounts:list': async () => listAccounts(ctx, paths),
    'accounts:connect': async (request) => connectAccount(ctx, paths, request),
    'accounts:remove': async (request) => removeAccount(ctx, paths, request),
    'gateway-token:status': async () => getGatewayTokenStatus(ctx, paths),
    'gateway-token:mint': async () => mintGatewayTokenIntoVault(ctx, paths),
    'gateway-token:copy': async () => copyGatewayTokenToClipboard(ctx, paths),
  };
}
