import type { EngineGateway, GatewayConfig } from '@recompose/contracts';

import type { EngineHost } from '../engine-host/engine-host';
import type { IpcHandlers } from './dispatch';

import { offerFreePort } from '../engine-host/free-port';
import { storedEngineGateway } from '../engine-host/stored-gateway';
import { listGatewayConfigs, saveGatewayConfig } from '../storage/gateway-store';
import { storagePathsFor } from './storage-context';
import { ipcFailure, storageFailure } from './storage-envelope';

export type EngineIpcContext = {
  host: EngineHost;
  userDataPath: string;
  homeFolder: string;
  onCorrupt: (quarantinedPath: string) => void;
  probeFreePort: () => Promise<number>;
};

export type EngineIpcHandlers = Pick<
  IpcHandlers,
  'gateways:offer-port' | 'gateways:move-port' | 'engine:start' | 'engine:stop' | 'engine:states'
>;

function asEngineGateway(config: GatewayConfig): EngineGateway {
  return { slug: config.slug, displayName: config.displayName, port: config.port };
}

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
  return offerFreePort(new Set(stored.map((config) => config.port)), ctx.probeFreePort);
}

async function offerPort(ctx: EngineIpcContext) {
  try {
    return { ok: true as const, value: await portFreeOf(ctx, await storedGateways(ctx)) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

async function movePort(ctx: EngineIpcContext, slug: string) {
  try {
    const stored = await storedGateways(ctx);
    const moving = stored.find((config) => config.slug === slug);

    if (moving === undefined) {
      return noSuchGateway(slug);
    }

    const moved = { ...moving, port: await portFreeOf(ctx, stored) };

    await saveGatewayConfig(storagePathsFor(ctx.userDataPath).gatewaysDir, moved);
    await ctx.host.restart(asEngineGateway(moved));

    return { ok: true as const, value: await storedGateways(ctx) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

async function startGateway(ctx: EngineIpcContext, slug: string) {
  try {
    const starting = await storedEngineGateway(
      storagePathsFor(ctx.userDataPath).gatewaysDir,
      ctx.onCorrupt,
      slug,
    );

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
    'gateways:move-port': async ({ slug }) => movePort(ctx, slug),
    'engine:start': async ({ slug }) => startGateway(ctx, slug),
    'engine:stop': async ({ slug }) => stopGateway(ctx, slug),
    'engine:states': async () => Promise.resolve({ ok: true as const, value: ctx.host.states() }),
  };
}
