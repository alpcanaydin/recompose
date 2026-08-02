import { setTimeout as sleepFor } from 'node:timers/promises';
import { beforeEach, describe, expect, test } from 'vitest';

import type { SubscriptionsIpcContext } from './subscriptions-ipc';
import type { SubscriptionsWorld } from './subscriptions-ipc.testkit';

import { PARKED_SERVICE, VENDOR_SERVICE } from '../subscriptions/credential-custody';
import { osUser } from '../subscriptions/subscriptions.testkit';
import { createSubscriptionsIpcHandlers } from './subscriptions-ipc';
import { aFreshWorld, claudeCodeSignedIn, refusalIn, viewsIn } from './subscriptions-ipc.testkit';

let world: SubscriptionsWorld;

function handlersOn(platform: NodeJS.Platform, launch: SubscriptionsIpcContext['launch']) {
  return createSubscriptionsIpcHandlers(world.contextOn(platform, launch));
}

function claudeCodeSigningIn(platform: NodeJS.Platform) {
  const homes = world.homesOn(platform);

  return {
    homes,
    launch: world.toolSigningIn(homes, 'anthropic', claudeCodeSignedIn('ada@ex.com', 'max')),
  };
}

beforeEach(async () => {
  world = await aFreshWorld();
});

describe('signing in through the provider tool', () => {
  test('given the tool is not installed, the sign-in refuses by name and nothing is launched', async () => {
    const answered = await handlersOn('linux', world.nothingHappens)['subscriptions:sign-in']({
      provider: 'anthropic',
    });

    expect(refusalIn(answered).code).toBe('tool-missing');
    expect(refusalIn(answered).message).toContain('Claude Code');
    expect(world.launched).toEqual([]);
  });

  test('given the tool signs somebody in, the account is stored, active, and connected', async () => {
    await world.toolInstalled('claude');
    const { homes, launch } = claudeCodeSigningIn('linux');

    const answered = await handlersOn('linux', launch)['subscriptions:sign-in']({
      provider: 'anthropic',
    });

    expect(viewsIn(answered)).toEqual([
      expect.objectContaining({
        provider: 'anthropic',
        signedInAs: 'ada@ex.com',
        plan: 'max',
        standing: 'connected',
        active: true,
      }),
    ]);
    const stored = await world.storedAccounts();

    expect(stored.accounts).toHaveLength(1);
    await expect(homes.readActive('anthropic')).resolves.toBe(stored.accounts[0]?.id);
  });

  test('given the tool is launched, the command it is handed points at the sign-in home', async () => {
    await world.toolInstalled('codex');
    const homes = world.homesOn('linux');
    const launch = world.toolSigningIn(homes, 'openai', { 'auth.json': { tokens: {} } });

    await handlersOn('linux', launch)['subscriptions:sign-in']({ provider: 'openai' });

    expect(world.launched).toEqual([`CODEX_HOME="${homes.pendingHomeFor('openai')}" codex login`]);
  });

  test('given a tool that names nobody, the account is labelled after the tool itself', async () => {
    await world.toolInstalled('codex');
    const homes = world.homesOn('linux');
    const launch = world.toolSigningIn(homes, 'openai', { 'auth.json': { tokens: {} } });

    await handlersOn('linux', launch)['subscriptions:sign-in']({ provider: 'openai' });

    await expect(world.storedAccounts()).resolves.toMatchObject({ accounts: [{ label: 'Codex' }] });
  });
});

describe('signing in when nobody finishes and when no terminal opens', () => {
  test('given nobody ever finishes the sign-in, it times out and stores no account', async () => {
    await world.toolInstalled('claude');

    const answered = await handlersOn('linux', world.nothingHappens)['subscriptions:sign-in']({
      provider: 'anthropic',
    });

    expect(refusalIn(answered).code).toBe('sign-in-timed-out');
    expect(refusalIn(answered).message).toContain('Claude Code');
    await expect(world.storedAccounts()).resolves.toEqual({ schemaVersion: 2, accounts: [] });
  });

  test('given a terminal that will not open, the sign-in still watches for the tool', async () => {
    await world.toolInstalled('claude');
    const { launch } = claudeCodeSigningIn('linux');

    const answered = await handlersOn('linux', async (command) => {
      await launch(command);

      throw new Error('no terminal emulator answered');
    })['subscriptions:sign-in']({ provider: 'anthropic' });

    expect(answered.ok).toBe(true);
  });
});

describe('signing in on macOS, where the tool keeps its credential in the keychain', () => {
  test('given a credential already in the keychain, it is parked before the tool runs', async () => {
    await world.toolInstalled('claude');
    world.keychain.put(VENDOR_SERVICE, osUser, 'someone-elses-login');
    const { launch } = claudeCodeSigningIn('darwin');

    const answered = await handlersOn('darwin', launch)['subscriptions:sign-in']({
      provider: 'anthropic',
    });
    const stored = await world.storedAccounts();
    const newId = stored.accounts[0]?.id ?? 'missing';

    expect(answered.ok).toBe(true);
    expect(world.keychain.blobAt(PARKED_SERVICE, 'login-before-recompose')).toBe(
      'someone-elses-login',
    );
    expect(world.keychain.blobAt(PARKED_SERVICE, newId)).toBe('fresh-blob');
  });

  test('given a denied keychain prompt, the sign-in refuses before the tool runs', async () => {
    await world.toolInstalled('claude');
    world.keychain.denyEverything();

    const answered = await handlersOn('darwin', world.nothingHappens)['subscriptions:sign-in']({
      provider: 'anthropic',
    });

    expect(refusalIn(answered).code).toBe('keychain-denied');
    expect(world.launched).toEqual([]);
  });

  test('given a sign-in that times out, the credential that was there is put back', async () => {
    await world.toolInstalled('claude');
    world.keychain.put(VENDOR_SERVICE, osUser, 'someone-elses-login');

    await handlersOn('darwin', world.nothingHappens)['subscriptions:sign-in']({
      provider: 'anthropic',
    });

    expect(world.keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('someone-elses-login');
  });

  test('given a sign-in that breaks partway, the credential that was there is put back', async () => {
    await world.toolInstalled('claude');
    world.keychain.put(VENDOR_SERVICE, osUser, 'someone-elses-login');
    const handlers = createSubscriptionsIpcHandlers({
      ...world.contextOn('darwin', world.nothingHappens),
      clock: () => ({
        elapsed: () => 0,
        sleep: async () => {
          await Promise.reject(new Error('the machine stopped answering'));
        },
      }),
    });

    const answered = await handlers['subscriptions:sign-in']({ provider: 'anthropic' });

    expect(answered.ok).toBe(false);
    expect(world.keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('someone-elses-login');
  });
});

describe('signing in when the login that stood before cannot be put back', () => {
  test('given the keychain refusing the restore, the sign-in says so rather than reporting a timeout', async () => {
    await world.toolInstalled('claude');
    world.keychain.put(VENDOR_SERVICE, osUser, 'someone-elses-login');

    const answered = await handlersOn('darwin', async () => {
      world.keychain.denyEverything();

      return Promise.resolve();
    })['subscriptions:sign-in']({ provider: 'anthropic' });

    expect(refusalIn(answered).code).toBe('keychain-denied');
    expect(world.keychain.blobAt(PARKED_SERVICE, 'login-before-recompose')).toBe(
      'someone-elses-login',
    );
  });
});

describe('bringing a lapsed account back', () => {
  test('given a lapsed account, restoring signs it back in under the same account', async () => {
    await world.toolInstalled('claude');
    await world.alreadyHolding([
      { id: 'acc-one', provider: 'anthropic', kind: 'subscription', label: 'Ada' },
    ]);
    const homes = world.homesOn('linux');
    const launch = world.toolSigningIn(homes, 'anthropic', claudeCodeSignedIn('ada@ex.com', 'pro'));

    const answered = await handlersOn('linux', launch)['subscriptions:restore']({ id: 'acc-one' });

    expect(viewsIn(answered)).toEqual([
      expect.objectContaining({ id: 'acc-one', standing: 'connected', active: true }),
    ]);
    await expect(world.storedAccounts()).resolves.toMatchObject({ accounts: [{ id: 'acc-one' }] });
  });

  test('given an account nobody holds, restoring refuses and names the account', async () => {
    const answered = await handlersOn('linux', world.nothingHappens)['subscriptions:restore']({
      id: 'acc-nowhere',
    });

    expect(refusalIn(answered).code).toBe('storage-failed');
    expect(refusalIn(answered).message).toContain('acc-nowhere');
  });
});

describe('signing the same address in again', () => {
  test('given the tool lands an address already held, the account is written over, not doubled', async () => {
    await world.toolInstalled('claude');
    const { launch } = claudeCodeSigningIn('linux');
    const handlers = handlersOn('linux', launch);

    await handlers['subscriptions:sign-in']({ provider: 'anthropic' });
    const before = await world.storedAccounts();

    await handlers['subscriptions:sign-in']({ provider: 'anthropic' });
    const after = await world.storedAccounts();

    expect(after.accounts).toHaveLength(1);
    expect(after.accounts[0]?.id).toBe(before.accounts[0]?.id);
  });

  test('given a tool that names nobody, a second sign-in stands as its own account', async () => {
    await world.toolInstalled('codex');
    const homes = world.homesOn('linux');
    const launch = world.toolSigningIn(homes, 'openai', { 'auth.json': { tokens: {} } });
    const handlers = handlersOn('linux', launch);

    await handlers['subscriptions:sign-in']({ provider: 'openai' });
    await handlers['subscriptions:sign-in']({ provider: 'openai' });

    await expect(world.storedAccounts()).resolves.toMatchObject({
      accounts: [expect.anything(), expect.anything()],
    });
  });
});

describe('the handlers run one turn at a time', () => {
  test('given a sign-in still waiting, the list answers without queueing behind it', async () => {
    await world.toolInstalled('claude');
    let releaseTheTool = (): void => undefined;
    const theToolIsStillOpen = new Promise<void>((resolve) => {
      releaseTheTool = resolve;
    });
    const handlers = handlersOn('linux', async () => theToolIsStillOpen);
    const signingIn = handlers['subscriptions:sign-in']({ provider: 'anthropic' });

    const winner = await Promise.race([
      handlers['subscriptions:list']().then(() => 'the list answered'),
      sleepFor(100, 'the list waited for the sign-in'),
    ]);

    expect(winner).toBe('the list answered');
    releaseTheTool();
    await signingIn;
  });

  test('given two sign-ins asked for together, two addresses land as two accounts', async () => {
    await world.toolInstalled('claude');
    const homes = world.homesOn('linux');
    const eachInTurn = [
      world.toolSigningIn(homes, 'anthropic', claudeCodeSignedIn('ada@ex.com', 'max')),
      world.toolSigningIn(homes, 'anthropic', claudeCodeSignedIn('grace@ex.com', 'max')),
    ];
    const handlers = handlersOn('linux', async (command) => eachInTurn.shift()?.(command));

    await Promise.all([
      handlers['subscriptions:sign-in']({ provider: 'anthropic' }),
      handlers['subscriptions:sign-in']({ provider: 'anthropic' }),
    ]);

    await expect(world.storedAccounts()).resolves.toMatchObject({
      accounts: [expect.anything(), expect.anything()],
    });
  });
});
