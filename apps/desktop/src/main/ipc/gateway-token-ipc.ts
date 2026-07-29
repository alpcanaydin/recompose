import type { StorageIpcContext, StoragePaths } from './storage-context';

import {
  GATEWAY_TOKEN_REF,
  gatewayTokenStorageState,
  maskGatewayToken,
  mintGatewayToken,
} from '../settings/gateway-token';
import { getSecret, saveVaultFile, setSecret } from '../storage/vault';
import { openVaultForWrite } from './storage-context';
import { ipcFailure, openVault, storageFailure } from './storage-envelope';

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

export async function getGatewayTokenStatus(ctx: StorageIpcContext, paths: StoragePaths) {
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

export async function mintGatewayTokenIntoVault(ctx: StorageIpcContext, paths: StoragePaths) {
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

export async function copyGatewayTokenToClipboard(ctx: StorageIpcContext, paths: StoragePaths) {
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
