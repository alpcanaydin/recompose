import type { GatewayConfig } from '@recompose/contracts';

import type { EngineHost } from '../engine-host/engine-host';
import type { IpcHandlers } from './dispatch';

import { engineGatewayOf, storedEngineGateway } from '../engine-host/stored-gateway';
import { listGatewayConfigs, saveGatewayConfig } from '../storage/gateway-store';
import { inGatewayWriteOrder } from '../storage/gateway-write-order';
import { storagePathsFor } from './storage-context';
import { ipcFailure, storageFailure } from './storage-envelope';

export type EngineIpcContext = {
  host: EngineHost;
  userDataPath: string;
  homeFolder: string;
  onCorrupt: (quarantinedPath: string) => void;
  probeFreePort: (taken: ReadonlySet<number>, installFolder: string) => Promise<number>;
};

export type EngineIpcHandlers = Pick<
  IpcHandlers,
  'gateways:offer-port' | 'gateways:move-port' | 'engine:start' | 'engine:stop' | 'engine:states'
>;

function noSuchGateway(slug: string) {
  return ipcFailure(
    'storage-failed',
    `recompose stores no gateway under the slug "${slug}", so it has nothing to reach.`,
  );
}

async function storedGateways(ctx: EngineIpcContext): Promise<GatewayConfig[]> {
  return listGatewayConfigs(storagePathsFor(ctx.userDataPath).gatewaysDir, ctx.onCorrupt);
}

async function portFreeOf(
  ctx: EngineIpcContext,
  stored: readonly GatewayConfig[],
): Promise<number> {
  return ctx.probeFreePort(new Set(stored.map((config) => config.port)), ctx.userDataPath);
}

async function offerPort(ctx: EngineIpcContext) {
  try {
    return { ok: true as const, value: await portFreeOf(ctx, await storedGateways(ctx)) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

/**
 * Moves a gateway that lost its port onto a free one, and serves it there.
 *
 * @summary It rewrites a gateway document, so it takes the same lane the create and the rewrite
 * take. Without that, a definition stored between this read and this write would be erased by the
 * stale copy held here, and the caller who stored it would already have read success.
 */
async function movePort(ctx: EngineIpcContext, slug: string) {
  try {
    const stored = await storedGateways(ctx);
    const moving = stored.find((config) => config.slug === slug);

    if (moving === undefined) {
      return noSuchGateway(slug);
    }

    const moved = { ...moving, port: await portFreeOf(ctx, stored) };

    await ctx.host.restart(await engineGatewayOf(ctx.userDataPath, ctx.onCorrupt, moved));
    await saveGatewayConfig(storagePathsFor(ctx.userDataPath).gatewaysDir, moved);

    return { ok: true as const, value: await storedGateways(ctx) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

async function startGateway(ctx: EngineIpcContext, slug: string) {
  try {
    const starting = await storedEngineGateway(ctx.userDataPath, ctx.onCorrupt, slug);

    if (starting === undefined) {
      return noSuchGateway(slug);
    }

    return { ok: true as const, value: await ctx.host.start(starting) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

async function stopGateway(ctx: EngineIpcContext, slug: string) {
  try {
    return { ok: true as const, value: await ctx.host.stop(slug) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

export function createEngineIpcHandlers(ctx: EngineIpcContext): EngineIpcHandlers {
  return {
    'gateways:offer-port': async () => offerPort(ctx),
    'gateways:move-port': async ({ slug }) => inGatewayWriteOrder(async () => movePort(ctx, slug)),
    'engine:start': async ({ slug }) => startGateway(ctx, slug),
    'engine:stop': async ({ slug }) => stopGateway(ctx, slug),
    'engine:states': async () => Promise.resolve({ ok: true as const, value: ctx.host.states() }),
  };
}
