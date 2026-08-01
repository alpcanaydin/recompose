import { beforeEach, describe, expect, test } from 'vitest';

import type { SubscriptionHomes } from '../subscriptions/subscription-homes';
import type { SubscriptionsWorld } from './subscriptions-ipc.testkit';

import { PARKED_SERVICE, VENDOR_SERVICE } from '../subscriptions/credential-custody';
import { osUser } from '../subscriptions/subscriptions.testkit';
import { createSubscriptionsIpcHandlers } from './subscriptions-ipc';
import { aFreshWorld, refusalIn, viewsIn } from './subscriptions-ipc.testkit';

let world: SubscriptionsWorld;

function handlersOn(platform: NodeJS.Platform = 'linux') {
  return createSubscriptionsIpcHandlers(world.contextOn(platform, world.nothingHappens));
}

async function twoAnthropicAccounts(platform: NodeJS.Platform): Promise<SubscriptionHomes> {
  const homes = world.homesOn(platform);

  await homes.resetPending('anthropic');
  await homes.promotePending('anthropic', 'acc-one');
  await homes.resetPending('anthropic');
  await homes.promotePending('anthropic', 'acc-two');
  await homes.pointActiveAt('anthropic', 'acc-one');
  await world.alreadyHolding([
    { id: 'acc-one', provider: 'anthropic', kind: 'subscription', label: 'Ada' },
    { id: 'acc-two', provider: 'anthropic', kind: 'subscription', label: 'Grace' },
  ]);

  return homes;
}

beforeEach(async () => {
  world = await aFreshWorld();
});

describe('choosing which account the provider tool answers to', () => {
  test('given two accounts, activating one moves the pointer and the list says so', async () => {
    const homes = await twoAnthropicAccounts('linux');

    const answered = await handlersOn()['subscriptions:activate']({ id: 'acc-two' });

    expect(viewsIn(answered).map((view) => [view.id, view.active])).toEqual([
      ['acc-one', false],
      ['acc-two', true],
    ]);
    await expect(homes.readActive('anthropic')).resolves.toBe('acc-two');
  });

  test('given an account nobody holds, activating refuses and names the account', async () => {
    const answered = await handlersOn()['subscriptions:activate']({ id: 'acc-nowhere' });

    expect(refusalIn(answered).code).toBe('storage-failed');
    expect(refusalIn(answered).message).toContain('acc-nowhere');
  });

  test('given a pasted-key account, activating refuses rather than treating it as a subscription', async () => {
    await world.alreadyHolding([
      {
        id: 'acc-key',
        provider: 'openrouter',
        kind: 'api-key',
        label: 'OpenRouter',
        credentialRef: 'cred-key',
      },
    ]);

    const answered = await handlersOn()['subscriptions:activate']({ id: 'acc-key' });

    expect(refusalIn(answered).code).toBe('storage-failed');
  });
});

describe('activating on macOS, where the tool keeps its credential in the keychain', () => {
  test('given two accounts, activating hands the vendor item over to the incoming one', async () => {
    await twoAnthropicAccounts('darwin');
    world.keychain.put(VENDOR_SERVICE, osUser, 'blob-one');
    world.keychain.put(PARKED_SERVICE, 'acc-two', 'blob-two');

    await handlersOn('darwin')['subscriptions:activate']({ id: 'acc-two' });

    expect(world.keychain.blobAt(PARKED_SERVICE, 'acc-one')).toBe('blob-one');
    expect(world.keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('blob-two');
  });

  test('given a denied prompt, the pointer stays where it was', async () => {
    const homes = await twoAnthropicAccounts('darwin');

    world.keychain.denyEverything();

    const answered = await handlersOn('darwin')['subscriptions:activate']({ id: 'acc-two' });

    expect(refusalIn(answered).code).toBe('keychain-denied');
    await expect(homes.readActive('anthropic')).resolves.toBe('acc-one');
  });
});
