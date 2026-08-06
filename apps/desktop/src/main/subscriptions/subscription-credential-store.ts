import type { SubscriptionProviderId } from '@recompose/contracts';

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CredentialCustody } from './credential-custody';

import { oneAtATime } from '../storage/one-at-a-time';
import { subscriptionHomes } from './subscription-homes';

export type SubscriptionCredentialStore = {
  read: (provider: SubscriptionProviderId, accountId: string) => Promise<string | null>;
  write: (provider: SubscriptionProviderId, accountId: string, blob: string) => Promise<void>;
};

function fileNameFor(provider: SubscriptionProviderId): string {
  if (provider === 'anthropic') {
    return '.credentials.json';
  }

  return provider === 'antigravity' ? 'antigravity.json' : 'auth.json';
}

async function readCredentialFile(path: string): Promise<string | null> {
  return readFile(path, 'utf8').catch((cause: unknown) => {
    if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') {
      return null;
    }

    throw cause;
  });
}

export function subscriptionCredentialStore(
  userDataPath: string,
  platform: NodeJS.Platform,
  custody: CredentialCustody | null,
): SubscriptionCredentialStore {
  const homes = subscriptionHomes(userDataPath, platform);
  const lane = oneAtATime();
  const livesInKeychain = (provider: SubscriptionProviderId): boolean =>
    platform === 'darwin' && provider === 'anthropic';
  const isActive = async (provider: SubscriptionProviderId, accountId: string): Promise<boolean> =>
    (await homes.readActive(provider)) === accountId;

  const fileFor = (provider: SubscriptionProviderId, accountId: string): string =>
    join(homes.homeFor(provider, accountId), fileNameFor(provider));

  return {
    read: async (provider, accountId) =>
      lane(async () => {
        if (livesInKeychain(provider)) {
          return custody?.readFor(accountId, await isActive(provider, accountId)) ?? null;
        }

        return readCredentialFile(fileFor(provider, accountId));
      }),

    write: async (provider, accountId, blob) =>
      lane(async () => {
        if (livesInKeychain(provider)) {
          if (custody === null) {
            throw new Error('Claude credential custody is unavailable');
          }

          await custody.writeFor(accountId, await isActive(provider, accountId), blob);

          return;
        }

        const home = homes.homeFor(provider, accountId);
        const destination = fileFor(provider, accountId);
        const pending = `${destination}.recompose-refresh`;

        await mkdir(home, { recursive: true });
        await writeFile(pending, blob, { encoding: 'utf8', mode: 0o600 });
        await rename(pending, destination);
      }),
  };
}
