import type {
  AccountsDocument,
  SubscriptionAccountView,
  SubscriptionProviderId,
} from '@recompose/contracts';

import type { CredentialCustody, CustodyOutcome } from '../subscriptions/credential-custody';
import type { SignInLaunch } from '../subscriptions/sign-in-launch';
import type { SubscriptionHomes } from '../subscriptions/subscription-homes';
import type { Clock } from '../subscriptions/subscription-sign-in';

import { loadAccountsFile } from '../storage/accounts-store';
import { subscriptionViews } from '../subscriptions/subscription-views';
import { reportTools } from '../subscriptions/tool-presence';
import { ipcFailure } from './storage-envelope';

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

export type Answered =
  | { ok: true; value: SubscriptionAccountView[] }
  | ReturnType<typeof ipcFailure>;

/** The bench every subscription handler works over: the context, the homes, and the accounts file. */
export type Workshop = {
  ctx: SubscriptionsIpcContext;
  homes: SubscriptionHomes;
  accountsFile: string;
};

export function refusalFailure(outcome: CustodyOutcome & { ok: false }) {
  return ipcFailure(outcome.code, outcome.message);
}

export async function readAccounts(shop: Workshop): Promise<AccountsDocument> {
  return loadAccountsFile(shop.accountsFile, shop.ctx.onCorrupt);
}

export async function viewsOf(
  shop: Workshop,
  accounts: AccountsDocument,
): Promise<SubscriptionAccountView[]> {
  return subscriptionViews({ homes: shop.homes, custody: shop.ctx.custody }, accounts);
}

export async function toolPresent(
  shop: Workshop,
  provider: SubscriptionProviderId,
): Promise<boolean> {
  const tools = await reportTools({
    homes: shop.homes,
    searchPath: await shop.ctx.searchPath(),
    platform: shop.ctx.platform,
  });

  return tools.find((tool) => tool.provider === provider)?.present === true;
}

export async function parkUnder(
  custody: CredentialCustody | null,
  slot: string,
): Promise<CustodyOutcome> {
  return custody === null ? { ok: true } : custody.park(slot);
}

export async function putBack(
  custody: CredentialCustody | null,
  slot: string,
): Promise<CustodyOutcome> {
  return custody === null ? { ok: true } : custody.place(slot);
}
