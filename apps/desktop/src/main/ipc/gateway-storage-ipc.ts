import type { Account, GatewayConfig, IpcRequest, VirtualModel } from '@recompose/contracts';

import { gatewayConfigSchemaAgainstAccounts } from '@recompose/contracts';

import type { IpcHandlers } from './dispatch';
import type { StorageIpcContext, StoragePaths } from './storage-context';

import { engineGatewayOf } from '../engine-host/stored-gateway';
import { loadAccountsFile } from '../storage/accounts-store';
import { listGatewayConfigs, saveGatewayConfig } from '../storage/gateway-store';
import { inGatewayWriteOrder } from '../storage/gateway-write-order';
import { ipcFailure, storageFailure } from './storage-envelope';

export type GatewayStorageHandlers = Pick<
  IpcHandlers,
  'gateways:list' | 'gateways:save' | 'gateways:update'
>;

function noteGatewayWrite(ctx: StorageIpcContext, gateway: GatewayConfig): void {
  ctx.noteGatewayWrite?.(gateway);
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

function subscriptionAmong(accounts: readonly Account[], accountId: string): Account | undefined {
  const held = accounts.find((account) => account.id === accountId);

  return held?.kind === 'subscription' ? held : undefined;
}

function readsAs(account: Account): string {
  return 'label' in account ? account.label : account.provider;
}

function subscriptionBoundIn(
  accounts: readonly Account[],
  models: readonly VirtualModel[],
): string | undefined {
  for (const model of models) {
    const account = subscriptionAmong(accounts, model.target.accountId);

    if (account !== undefined) {
      return `The virtual model "${model.displayName}" names the subscription account "${readsAs(account)}", and a subscription account never stands as a target.`;
    }
  }

  return undefined;
}

/**
 * Whether the arriving document names a target the live registry refuses, and why.
 *
 * @summary The stored shape alone cannot tell a key from a plan, so the schema resolves against the
 * registry here, at the one boundary a definition arrives through. The picker never offers a
 * subscription, which makes this the contract behind that habit rather than a second copy of it,
 * and the sentence names the account a person would go and change.
 */
async function refusedTarget(ctx: StorageIpcContext, paths: StoragePaths, config: GatewayConfig) {
  const registry = await loadAccountsFile(paths.accountsFile, ctx.onCorrupt);
  const parsed = gatewayConfigSchemaAgainstAccounts(registry.accounts).safeParse(config);

  if (parsed.success) {
    return null;
  }

  return ipcFailure(
    'validation-failed',
    subscriptionBoundIn(registry.accounts, config.virtualModels) ?? parsed.error.message,
  );
}

async function saveGateway(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  config: IpcRequest<'gateways:save'>,
) {
  try {
    const stored = await listGatewayConfigs(paths.gatewaysDir, ctx.onCorrupt);
    const conflict = conflictWith(stored, config) ?? (await refusedTarget(ctx, paths, config));

    if (conflict !== null) {
      return conflict;
    }

    const serving = await engineGatewayOf(ctx.userDataPath, ctx.onCorrupt, config);

    await saveGatewayConfig(paths.gatewaysDir, config);
    noteGatewayWrite(ctx, config);
    ctx.startGateway(serving);

    return { ok: true as const, value: await listGatewayConfigs(paths.gatewaysDir, ctx.onCorrupt) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

function noSuchGateway(slug: string) {
  return ipcFailure(
    'storage-failed',
    `recompose stores no gateway under the slug "${slug}", so it has nothing to rewrite.`,
  );
}

/**
 * Rewrites the document a stored gateway already has, and serves what it now says.
 *
 * @summary A definition lands here rather than on the save, because the save exists to refuse a
 * slug already taken and that refusal is exactly what a second virtual model must not read. The
 * snapshot resolves before the write for the same reason the save resolves before its own: a
 * registry that cannot be read must leave the stored document alone.
 *
 * The port written is the stored one, never the arriving one, because this channel does not own
 * that field: the move lane does. A caller whose copy of the document predates a move would
 * otherwise reverse it, and refusing them instead would send a person to fix a port they never
 * touched. The answer carries the whole stored list, so a stale caller is corrected rather than
 * quietly overruled.
 *
 * A gateway already serving restarts, because the snapshot in front of it is now stale. One a
 * person stopped is left stopped: a save starts what it stored and a move restarts what it moved
 * because serving is the point of both acts, and editing a definition is not, so this must not be
 * the one write that contradicts an explicit stop.
 */
async function updateGateway(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  config: IpcRequest<'gateways:update'>,
) {
  try {
    const stored = await listGatewayConfigs(paths.gatewaysDir, ctx.onCorrupt);
    const held = stored.find((one) => one.slug === config.slug);

    if (held === undefined) {
      return noSuchGateway(config.slug);
    }

    const refused = await refusedTarget(ctx, paths, config);

    if (refused !== null) {
      return refused;
    }

    const rewritten = { ...config, port: held.port };
    const serving = await engineGatewayOf(ctx.userDataPath, ctx.onCorrupt, rewritten);

    await saveGatewayConfig(paths.gatewaysDir, rewritten);
    noteGatewayWrite(ctx, rewritten);

    if (ctx.isServing(rewritten.slug)) {
      ctx.restartGateway(serving);
    }

    return { ok: true as const, value: await listGatewayConfigs(paths.gatewaysDir, ctx.onCorrupt) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

/**
 * Every channel that reads or writes the gateways directory.
 *
 * @summary Both writes take the lane the move takes too, because all three list the directory
 * before deciding what to put back and the one that does not share it is the one that loses a
 * write.
 */
export function createGatewayStorageHandlers(
  ctx: StorageIpcContext,
  paths: StoragePaths,
): GatewayStorageHandlers {
  return {
    'gateways:list': async () => listGateways(ctx, paths),
    'gateways:save': async (config) =>
      inGatewayWriteOrder(async () => saveGateway(ctx, paths, config)),
    'gateways:update': async (config) =>
      inGatewayWriteOrder(async () => updateGateway(ctx, paths, config)),
  };
}
