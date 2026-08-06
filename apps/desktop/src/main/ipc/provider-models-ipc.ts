import type { LookCustody, ModelListing } from '@recompose/contracts';

import type { TargetCustodyContext } from '../engine-host/target-custody';
import type { IpcHandlers } from './dispatch';

import { resolveTargetCustody } from '../engine-host/target-custody';
import { storageFailure } from './storage-envelope';

export type ProviderModelsIpcContext = TargetCustodyContext & {
  /** Reads one provider's catalog through the child, the only process that ever fetches. */
  listModels: (origin: string, custody: LookCustody) => Promise<ModelListing>;
};

/** The context this desk runs on, built from storage reach and the engine that does the reading. */
export function providerModelsReach(
  reach: TargetCustodyContext,
  engine: { listModels: (origin: string, custody: LookCustody) => Promise<ModelListing> },
): ProviderModelsIpcContext {
  return { ...reach, listModels: async (origin, custody) => engine.listModels(origin, custody) };
}

type ProviderModelsIpcHandlers = Pick<IpcHandlers, 'accounts:list-models'>;

const nothingListed: ModelListing = { standing: 'unlisted' };

async function listModelsOf(ctx: ProviderModelsIpcContext, accountId: string) {
  try {
    const resolved = await resolveTargetCustody(ctx, accountId);

    if (resolved.verdict !== 'resolved') {
      return { ok: true as const, value: nothingListed };
    }

    return {
      ok: true as const,
      value: await ctx.listModels(resolved.providerOrigin, resolved.custody),
    };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

/**
 * The channel that answers what one stored account serves.
 *
 * @summary An account that resolves to no target reads as unlisted rather than as a refusal, so a
 * subscription, a row that is gone, a provider recompose reaches nothing for, and a vault that
 * lost its secret all leave the screen saying the one thing a person can act on. Storage that
 * cannot be read at all is a different matter and travels as a failure. The credential the vault
 * gave up lives in this call and in the message that carries it to the child, and nowhere else.
 */
export function createProviderModelsIpcHandlers(
  ctx: ProviderModelsIpcContext,
): ProviderModelsIpcHandlers {
  return { 'accounts:list-models': async ({ id }) => listModelsOf(ctx, id) };
}
