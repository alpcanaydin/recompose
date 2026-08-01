import type {
  AccountsDocument,
  IpcRequest,
  SubscriptionAccount,
  SubscriptionAccountView,
  SubscriptionProviderId,
} from '@recompose/contracts';

import { subscriptionProviders } from '@recompose/contracts';
import { randomUUID } from 'node:crypto';

import type { CredentialCustody, CustodyOutcome } from '../subscriptions/credential-custody';
import type { SignInLaunch } from '../subscriptions/sign-in-launch';
import type { SubscriptionHomes } from '../subscriptions/subscription-homes';
import type { Clock } from '../subscriptions/subscription-sign-in';
import type { SubscriptionObservation } from '../subscriptions/subscription-standing';
import type { IpcHandlers } from './dispatch';

import { loadAccountsFile, saveAccountsFile } from '../storage/accounts-store';
import { oneAtATime } from '../storage/one-at-a-time';
import { custodyOver, RESERVED_SLOT } from '../subscriptions/credential-custody';
import { signInCommandFor } from '../subscriptions/subscription-commands';
import { subscriptionHomes } from '../subscriptions/subscription-homes';
import { awaitSignIn } from '../subscriptions/subscription-sign-in';
import { observeSubscription } from '../subscriptions/subscription-standing';
import { isSubscription, subscriptionViews } from '../subscriptions/subscription-views';
import { reportTools } from '../subscriptions/tool-presence';
import { storagePathsFor } from './storage-context';
import { ipcFailure, storageFailure } from './storage-envelope';

export type SubscriptionsIpcContext = {
  userDataPath: string;
  /** The home directory this process runs under, so no account name reaches the screen. */
  homeFolder: string;
  platform: NodeJS.Platform;
  /** Only macOS keeps the Claude Code credential outside the config home, so elsewhere this is absent. */
  custody: CredentialCustody | null;
  searchPath: () => Promise<string>;
  launch: SignInLaunch;
  clock: () => Clock;
  signInBoundMs: number;
  signInEveryMs: number;
  onCorrupt: (quarantinedPath: string) => void;
};

export type SubscriptionsIpcHandlers = Pick<
  IpcHandlers,
  | 'subscriptions:list'
  | 'subscriptions:tools'
  | 'subscriptions:sign-in'
  | 'subscriptions:restore'
  | 'subscriptions:activate'
>;

type Answered = { ok: true; value: SubscriptionAccountView[] } | ReturnType<typeof ipcFailure>;

type Workshop = {
  ctx: SubscriptionsIpcContext;
  homes: SubscriptionHomes;
  accountsFile: string;
};

function refusalFailure(outcome: CustodyOutcome & { ok: false }) {
  return ipcFailure(outcome.code, outcome.message);
}

async function readAccounts(shop: Workshop): Promise<AccountsDocument> {
  return loadAccountsFile(shop.accountsFile, shop.ctx.onCorrupt);
}

async function viewsOf(
  shop: Workshop,
  accounts: AccountsDocument,
): Promise<SubscriptionAccountView[]> {
  return subscriptionViews({ homes: shop.homes, custody: shop.ctx.custody }, accounts);
}

async function toolPresent(shop: Workshop, provider: SubscriptionProviderId): Promise<boolean> {
  const tools = await reportTools({
    homes: shop.homes,
    searchPath: await shop.ctx.searchPath(),
    platform: shop.ctx.platform,
  });

  return tools.find((tool) => tool.provider === provider)?.present === true;
}

async function parkUnder(custody: CredentialCustody | null, slot: string): Promise<CustodyOutcome> {
  return custody === null ? { ok: true } : custody.park(slot);
}

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

async function runTheTool(
  shop: Workshop,
  provider: SubscriptionProviderId,
  custody: CredentialCustody | null,
  previous: string,
): Promise<SubscriptionObservation | null> {
  const home = await shop.homes.resetPending(provider);

  await shop.ctx
    .launch(signInCommandFor({ provider, home, platform: shop.ctx.platform }))
    .catch(() => undefined);

  const observed = await awaitSignIn({
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

  if (observed === null && custody !== null) {
    await custody.place(previous);
  }

  return observed;
}

async function keepTheAccount(shop: Workshop, row: SubscriptionAccount): Promise<AccountsDocument> {
  const accounts = await readAccounts(shop);
  const updated = {
    ...accounts,
    accounts: [...accounts.accounts.filter((one) => one.id !== row.id), row],
  };

  await saveAccountsFile(shop.accountsFile, updated);
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
  const id = existingId ?? `acc-${randomUUID()}`;

  await shop.homes.promotePending(provider, id);

  const parked = await parkUnder(custody, id);

  if (!parked.ok) {
    return refusalFailure(parked);
  }

  const label = observed.signedInAs ?? subscriptionProviders[provider].toolName;
  const kept = await keepTheAccount(shop, { id, provider, kind: 'subscription', label });

  return { ok: true, value: await viewsOf(shop, kept) };
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
  const previous = (await shop.homes.readActive(provider)) ?? RESERVED_SLOT;
  const refused = await makeRoomForTheSignIn(custody, previous);

  if (refused !== null) {
    return refused;
  }

  const observed = await runTheTool(shop, provider, custody, previous);

  if (observed === null) {
    return ipcFailure(
      'sign-in-timed-out',
      `${toolName} did not finish signing in before recompose stopped waiting.`,
    );
  }

  return afterTheToolAnswers(shop, provider, existingId, custody, observed);
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
  const inTurn = oneAtATime();

  const guarded = (work: () => Promise<Answered>) => async (): Promise<Answered> => {
    try {
      return await work();
    } catch (error) {
      return storageFailure(error, ctx.homeFolder);
    }
  };

  return {
    'subscriptions:list': async () =>
      inTurn(
        guarded(async () => ({ ok: true, value: await viewsOf(shop, await readAccounts(shop)) })),
      ),

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
