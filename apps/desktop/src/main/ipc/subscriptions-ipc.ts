import type {
  AccountsDocument,
  IpcRequest,
  SubscriptionAccount,
  SubscriptionProviderId,
} from '@recompose/contracts';

import { subscriptionProviders } from '@recompose/contracts';
import { randomUUID } from 'node:crypto';

import type { CredentialCustody, CustodyOutcome } from '../subscriptions/credential-custody';
import type { SubscriptionObservation } from '../subscriptions/subscription-standing';
import type { IpcHandlers } from './dispatch';
import type { Answered, SubscriptionsIpcContext, Workshop } from './subscriptions-workshop';

import { amendAccountsFile } from '../storage/accounts-store';
import { oneAtATime } from '../storage/one-at-a-time';
import { custodyOver, RESERVED_SLOT } from '../subscriptions/credential-custody';
import { signInCommandFor } from '../subscriptions/subscription-commands';
import { subscriptionHomes } from '../subscriptions/subscription-homes';
import { awaitSignIn } from '../subscriptions/subscription-sign-in';
import { observeSubscription } from '../subscriptions/subscription-standing';
import { heldUnderTheAddress, isSubscription } from '../subscriptions/subscription-views';
import { reportTools } from '../subscriptions/tool-presence';
import { storagePathsFor } from './storage-context';
import { ipcFailure, storageFailure } from './storage-envelope';
import {
  parkUnder,
  putBack,
  readAccounts,
  refusalFailure,
  toolPresent,
  viewsOf,
} from './subscriptions-workshop';

export type { SubscriptionsIpcContext };

export type SubscriptionsIpcHandlers = Pick<
  IpcHandlers,
  | 'subscriptions:list'
  | 'subscriptions:tools'
  | 'subscriptions:sign-in'
  | 'subscriptions:restore'
  | 'subscriptions:activate'
>;

async function makeRoomForTheSignIn(
  custody: CredentialCustody | null,
  previous: string,
): Promise<Answered | null> {
  const parked = await parkUnder(custody, previous);

  if (!parked.ok) {
    return refusalFailure(parked);
  }

  if (custody === null) {
    return null;
  }

  const cleared = await custody.clear();

  return cleared.ok ? null : refusalFailure(cleared);
}

type ToolRun = { landed: SubscriptionObservation | null; restored: CustodyOutcome };

/**
 * Runs the provider's tool and hands back what it left behind, alongside how the restore went.
 *
 * @summary The vendor slot stands empty from here until the tool fills it, so anything short of a
 * finished sign-in, a timeout as much as a broken run, has to put the parked credential back. A
 * restore the keychain refuses leaves nobody signed in, which is worse news than the timeout, so
 * the caller hears about it rather than the sign-in swallowing it.
 */
async function runTheTool(
  shop: Workshop,
  provider: SubscriptionProviderId,
  custody: CredentialCustody | null,
  previous: string,
): Promise<ToolRun> {
  let landed: SubscriptionObservation | null = null;
  let restored: CustodyOutcome = { ok: true };

  try {
    const home = await shop.homes.resetPending(provider);

    await shop.ctx
      .launch(signInCommandFor({ provider, home, platform: shop.ctx.platform }))
      .catch(() => undefined);

    landed = await awaitSignIn({
      observe: async () =>
        observeSubscription({
          provider,
          home,
          outsideCredential: custody === null ? null : async () => custody.vendorStands(),
        }),
      clock: shop.ctx.clock(),
      boundMs: shop.ctx.signInBoundMs,
      everyMs: shop.ctx.signInEveryMs,
    });
  } finally {
    if (landed === null) {
      restored = await putBack(custody, previous);
    }
  }

  return { landed, restored };
}

async function keepTheAccount(shop: Workshop, row: SubscriptionAccount): Promise<AccountsDocument> {
  const updated = await amendAccountsFile(shop.accountsFile, shop.ctx.onCorrupt, (accounts) => ({
    ...accounts,
    accounts: [...accounts.accounts.filter((one) => one.id !== row.id), row],
  }));

  await shop.homes.pointActiveAt(row.provider, row.id);

  return updated;
}

async function afterTheToolAnswers(
  shop: Workshop,
  provider: SubscriptionProviderId,
  existingId: string | null,
  custody: CredentialCustody | null,
  observed: SubscriptionObservation,
): Promise<Answered> {
  const held =
    existingId ??
    (await heldUnderTheAddress(
      shop.homes,
      await readAccounts(shop),
      provider,
      observed.signedInAs,
    ));
  const id = held ?? `acc-${randomUUID()}`;

  await shop.homes.promotePending(provider, id);

  const parked = await parkUnder(custody, id);

  if (!parked.ok) {
    return refusalFailure(parked);
  }

  const label = observed.signedInAs ?? subscriptionProviders[provider].toolName;
  const kept = await keepTheAccount(shop, { id, provider, kind: 'subscription', label });

  return { ok: true, value: await viewsOf(shop, kept) };
}

async function activeSlot(shop: Workshop, provider: SubscriptionProviderId): Promise<string> {
  return (await shop.homes.readActive(provider)) ?? RESERVED_SLOT;
}

async function signIn(
  shop: Workshop,
  provider: SubscriptionProviderId,
  existingId: string | null,
): Promise<Answered> {
  const { toolName } = subscriptionProviders[provider];

  if (!(await toolPresent(shop, provider))) {
    return ipcFailure(
      'tool-missing',
      `${toolName} is not installed on this machine, so no sign-in can begin.`,
    );
  }

  const custody = custodyOver(shop.ctx.custody, provider);
  const previous = await activeSlot(shop, provider);
  const refused = await makeRoomForTheSignIn(custody, previous);

  if (refused !== null) {
    return refused;
  }

  const { landed, restored } = await runTheTool(shop, provider, custody, previous);

  if (!restored.ok) {
    return refusalFailure(restored);
  }

  if (landed === null) {
    return ipcFailure(
      'sign-in-timed-out',
      `${toolName} did not finish signing in before recompose stopped waiting.`,
    );
  }

  return afterTheToolAnswers(shop, provider, existingId, custody, landed);
}

async function heldSubscription(shop: Workshop, id: string): Promise<SubscriptionAccount | null> {
  const accounts = await readAccounts(shop);
  const row = accounts.accounts.find((candidate) => candidate.id === id);

  return row !== undefined && isSubscription(row) ? row : null;
}

async function activate(shop: Workshop, id: string): Promise<Answered> {
  const row = await heldSubscription(shop, id);

  if (row === null) {
    return ipcFailure('storage-failed', `no subscription account is held under ${id}.`);
  }

  const custody = custodyOver(shop.ctx.custody, row.provider);

  if (custody !== null) {
    const handed = await custody.handOver(await shop.homes.readActive(row.provider), id);

    if (!handed.ok) {
      return refusalFailure(handed);
    }
  }

  await shop.homes.pointActiveAt(row.provider, id);

  return { ok: true, value: await viewsOf(shop, await readAccounts(shop)) };
}

async function restore(shop: Workshop, id: string): Promise<Answered> {
  const row = await heldSubscription(shop, id);

  if (row === null) {
    return ipcFailure('storage-failed', `no subscription account is held under ${id}.`);
  }

  return signIn(shop, row.provider, id);
}

export function createSubscriptionsIpcHandlers(
  ctx: SubscriptionsIpcContext,
): SubscriptionsIpcHandlers {
  const shop: Workshop = {
    ctx,
    homes: subscriptionHomes(ctx.userDataPath, ctx.platform),
    accountsFile: storagePathsFor(ctx.userDataPath).accountsFile,
  };
  /**
   * The lane the writers queue in, which the readers stay out of.
   *
   * @summary A sign-in holds the lane for as long as somebody takes to finish in a browser, so a
   * read that queued behind it would leave the screen blank for minutes. The accounts file is
   * written whole, so a read alongside a write sees one version or the other, never half of each.
   */
  const inTurn = oneAtATime();

  const guarded = (work: () => Promise<Answered>) => async (): Promise<Answered> => {
    try {
      return await work();
    } catch (error) {
      return storageFailure(error, ctx.homeFolder);
    }
  };

  return {
    'subscriptions:list': guarded(async () => ({
      ok: true,
      value: await viewsOf(shop, await readAccounts(shop)),
    })),

    'subscriptions:tools': async () => {
      try {
        return {
          ok: true as const,
          value: await reportTools({
            homes: shop.homes,
            searchPath: await ctx.searchPath(),
            platform: ctx.platform,
          }),
        };
      } catch (error) {
        return storageFailure(error, ctx.homeFolder);
      }
    },

    'subscriptions:sign-in': async (request: IpcRequest<'subscriptions:sign-in'>) =>
      inTurn(guarded(async () => signIn(shop, request.provider, null))),

    'subscriptions:restore': async (request: IpcRequest<'subscriptions:restore'>) =>
      inTurn(guarded(async () => restore(shop, request.id))),

    'subscriptions:activate': async (request: IpcRequest<'subscriptions:activate'>) =>
      inTurn(guarded(async () => activate(shop, request.id))),
  };
}
