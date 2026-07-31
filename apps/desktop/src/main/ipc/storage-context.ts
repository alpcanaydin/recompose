import type { EngineGateway, Settings } from '@recompose/contracts';

import { join } from 'node:path';

import type { SecretCodec } from '../storage/safe-storage-codec';

import { ipcFailure, openVault } from './storage-envelope';

export type StorageIpcContext = {
  /** The home directory this process runs under, so no account name reaches the screen. */
  homeFolder: string;
  /** What the operating system currently holds for the login item. */
  readLoginItem: () => boolean;
  userDataPath: string;
  getCodec: () => SecretCodec;
  isEncryptionAvailable: () => boolean;
  onCorrupt: (quarantinedPath: string) => void;
  applySettings: (settings: Settings, askedLoginItem: boolean | undefined) => void;
  /** A stored gateway serves at once, and the outcome reaches the screen by push rather than here. */
  startGateway: (gateway: EngineGateway) => void;
};

export type StoragePaths = {
  gatewaysDir: string;
  settingsFile: string;
  accountsFile: string;
  vaultFile: string;
};

export function storagePathsFor(userDataPath: string): StoragePaths {
  return {
    gatewaysDir: join(userDataPath, 'gateways'),
    settingsFile: join(userDataPath, 'settings.json'),
    accountsFile: join(userDataPath, 'accounts.json'),
    vaultFile: join(userDataPath, 'vault.bin'),
  };
}

export async function openVaultForWrite(ctx: StorageIpcContext, paths: StoragePaths) {
  if (!ctx.isEncryptionAvailable()) {
    return ipcFailure('vault-unavailable', 'OS secret encryption is unavailable');
  }

  return openVault(paths.vaultFile, ctx.onCorrupt, ctx.homeFolder);
}
