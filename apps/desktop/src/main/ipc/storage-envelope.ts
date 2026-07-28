import type { IpcError } from '@recompose/contracts';

import { loadVaultFile, VaultNewerSchemaError } from '../storage/vault';

export function ipcFailure(code: IpcError['code'], message: string) {
  return { ok: false as const, error: { code, message } };
}

export function storageFailure(error: unknown) {
  return ipcFailure(
    'storage-failed',
    error instanceof Error ? error.message : 'storage operation failed',
  );
}

export async function openVault(vaultFile: string, onCorrupt: (quarantinedPath: string) => void) {
  try {
    return { ok: true as const, vault: await loadVaultFile(vaultFile, onCorrupt) };
  } catch (error) {
    if (error instanceof VaultNewerSchemaError) {
      return ipcFailure('vault-newer-schema', error.message);
    }

    return storageFailure(error);
  }
}
