import type { GatewayConfig, IpcRequest } from '@recompose/contracts';

import type { IpcHandlers } from './dispatch';
import type { StorageIpcContext, StoragePaths } from './storage-context';

import { engineGatewayOf } from '../engine-host/stored-gateway';
import { listGatewayConfigs, saveGatewayConfig } from '../storage/gateway-store';
import { ipcFailure, storageFailure } from './storage-envelope';

const PORT_MOVES_ELSEWHERE =
  'The port a gateway serves on changes through the move, never through a definition.';

export type GatewayStorageHandlers = Pick<
  IpcHandlers,
  'gateways:list' | 'gateways:save' | 'gateways:update'
>;

type WriteOrder = <Answer>(work: () => Promise<Answer>) => Promise<Answer>;

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

    const serving = await engineGatewayOf(ctx.userDataPath, ctx.onCorrupt, config);

    await saveGatewayConfig(paths.gatewaysDir, config);
    ctx.startGateway(serving);

    return { ok: true as const, value: await listGatewayConfigs(paths.gatewaysDir, ctx.onCorrupt) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

function rewriteRefusal(held: GatewayConfig | undefined, arriving: GatewayConfig) {
  if (held === undefined) {
    return ipcFailure(
      'storage-failed',
      `recompose stores no gateway under the slug "${arriving.slug}", so it has nothing to rewrite.`,
    );
  }

  return held.port === arriving.port ? null : ipcFailure('port-conflict', PORT_MOVES_ELSEWHERE);
}

/**
 * Rewrites the document a stored gateway already has, and serves what it now says.
 *
 * @summary A definition lands here rather than on the save, because the save exists to refuse a
 * slug already taken and that refusal is exactly what a second virtual model must not read. The
 * snapshot resolves before the write for the same reason the save resolves before its own: a
 * registry that cannot be read must leave the stored document alone. The gateway restarts rather
 * than starts, because it is already serving the snapshot this rewrite makes stale. A port arriving
 * changed is refused outright, since the move lane owns ports and silently keeping the stored one
 * would answer a caller with a document it did not ask for.
 */
async function updateGateway(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  config: IpcRequest<'gateways:update'>,
) {
  try {
    const stored = await listGatewayConfigs(paths.gatewaysDir, ctx.onCorrupt);
    const refusal = rewriteRefusal(
      stored.find((one) => one.slug === config.slug),
      config,
    );

    if (refusal !== null) {
      return refusal;
    }

    const serving = await engineGatewayOf(ctx.userDataPath, ctx.onCorrupt, config);

    await saveGatewayConfig(paths.gatewaysDir, config);
    ctx.restartGateway(serving);

    return { ok: true as const, value: await listGatewayConfigs(paths.gatewaysDir, ctx.onCorrupt) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

/**
 * Every channel that reads or writes the gateways directory.
 *
 * @summary The create and the rewrite share one write order, because both resolve the directory
 * before they touch it and a rewrite interleaved with a create would decide against a listing that
 * had already moved on.
 */
export function createGatewayStorageHandlers(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  inWriteOrder: WriteOrder,
): GatewayStorageHandlers {
  return {
    'gateways:list': async () => listGateways(ctx, paths),
    'gateways:save': async (config) => inWriteOrder(async () => saveGateway(ctx, paths, config)),
    'gateways:update': async (config) =>
      inWriteOrder(async () => updateGateway(ctx, paths, config)),
  };
}
