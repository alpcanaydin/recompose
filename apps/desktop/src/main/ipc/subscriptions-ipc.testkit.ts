import type {
  AccountsDocument,
  SubscriptionAccountView,
  SubscriptionProviderId,
} from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SubscriptionHomes } from '../subscriptions/subscription-homes';
import type { FakeKeychain } from '../subscriptions/subscriptions.testkit';
import type { SubscriptionsIpcContext, SubscriptionsIpcHandlers } from './subscriptions-ipc';

import { loadAccountsFile, saveAccountsFile } from '../storage/accounts-store';
import { credentialCustody, VENDOR_SERVICE } from '../subscriptions/credential-custody';
import { subscriptionHomes } from '../subscriptions/subscription-homes';
import { fakeClock, fakeKeychain, osUser } from '../subscriptions/subscriptions.testkit';

type Launch = SubscriptionsIpcContext['launch'];

export type SubscriptionsWorld = {
  userDataPath: string;
  keychain: FakeKeychain;
  launched: readonly string[];
  homesOn: (platform: NodeJS.Platform) => SubscriptionHomes;
  toolInstalled: (name: string) => Promise<void>;
  contextOn: (platform: NodeJS.Platform, launch: Launch) => SubscriptionsIpcContext;
  nothingHappens: Launch;
  toolSigningIn: (
    homes: SubscriptionHomes,
    provider: SubscriptionProviderId,
    records: Record<string, unknown>,
  ) => Launch;
  storedAccounts: () => Promise<AccountsDocument>;
  alreadyHolding: (rows: AccountsDocument['accounts']) => Promise<void>;
};

type Answered = Awaited<ReturnType<SubscriptionsIpcHandlers['subscriptions:list']>>;

export function refusalIn(answered: Answered): { code: string; message: string } {
  if (answered.ok) {
    throw new Error('the handler answered a value where a refusal was expected');
  }

  return answered.error;
}

export function viewsIn(answered: Answered): readonly SubscriptionAccountView[] {
  if (!answered.ok) {
    throw new Error(`the handler refused with ${answered.error.code} where views were expected`);
  }

  return answered.value;
}

export function claudeCodeSignedIn(address: string, plan: string): Record<string, unknown> {
  return {
    '.credentials.json': { claudeAiOauth: { accessToken: 'opaque', subscriptionType: plan } },
    '.claude.json': { oauthAccount: { emailAddress: address } },
  };
}

function contextIn(
  userDataPath: string,
  binFolder: string,
  keychain: FakeKeychain,
): SubscriptionsWorld['contextOn'] {
  return (platform, launch) => ({
    userDataPath,
    homeFolder: '/Users/ada',
    platform,
    custody: platform === 'darwin' ? credentialCustody(keychain.seam, osUser) : null,
    searchPath: async () => Promise.resolve(binFolder),
    launch,
    clock: fakeClock,
    signInBoundMs: 300,
    signInEveryMs: 100,
    onCorrupt: () => undefined,
  });
}

export async function aFreshWorld(): Promise<SubscriptionsWorld> {
  const [userDataPath, binFolder] = await Promise.all([
    mkdtemp(join(tmpdir(), 'recompose-subs-ipc-')),
    mkdtemp(join(tmpdir(), 'recompose-subs-bin-')),
  ]);
  const keychain = fakeKeychain();
  const launched: string[] = [];
  const accountsFile = join(userDataPath, 'accounts.json');

  return {
    userDataPath,
    keychain,
    launched,

    homesOn: (platform) => subscriptionHomes(userDataPath, platform),

    toolInstalled: async (name) => {
      const binary = join(binFolder, name);

      await writeFile(binary, '#!/bin/sh\nexit 0\n', 'utf8');
      await chmod(binary, 0o755);
    },

    contextOn: contextIn(userDataPath, binFolder, keychain),

    nothingHappens: async (command) => {
      launched.push(command);

      return Promise.resolve();
    },

    toolSigningIn: (homes, provider, records) => async (command) => {
      launched.push(command);

      const pending = homes.pendingHomeFor(provider);

      await Promise.all(
        Object.entries(records).map(async ([file, contents]) =>
          writeFile(join(pending, file), JSON.stringify(contents), 'utf8'),
        ),
      );

      if (provider === 'anthropic') {
        keychain.put(VENDOR_SERVICE, osUser, 'fresh-blob');
      }
    },

    storedAccounts: async () => loadAccountsFile(accountsFile, () => undefined),

    alreadyHolding: async (rows) => {
      await saveAccountsFile(accountsFile, { schemaVersion: ACCOUNTS_VERSION, accounts: rows });
    },
  };
}
