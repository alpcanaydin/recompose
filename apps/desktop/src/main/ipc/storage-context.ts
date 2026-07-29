import type { Settings } from '@recompose/contracts';

import { join } from 'node:path';

import type { SecretCodec } from '../storage/safe-storage-codec';

import { ipcFailure, openVault } from './storage-envelope';

export type StorageIpcContext = {
  /** What the operating system currently holds for the login item. */
  readLoginItem: () => boolean;
  userDataPath: string;
  getCodec: () => SecretCodec;
  isEncryptionAvailable: () => boolean;
  onCorrupt: (quarantinedPath: string) => void;
  writeClipboard: (text: string) => void;
  applySettings: (settings: Settings, previous: Settings) => void;
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

  return openVault(paths.vaultFile, ctx.onCorrupt);
}
