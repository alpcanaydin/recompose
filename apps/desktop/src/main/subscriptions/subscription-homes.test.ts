import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';

import { subscriptionHomes, type SubscriptionHomes } from './subscription-homes';

let userDataPath: string;
let homes: SubscriptionHomes;

async function stands(folder: string): Promise<boolean> {
  return stat(folder).then(
    () => true,
    () => false,
  );
}

async function signedInAsPending(provider: 'anthropic' | 'openai'): Promise<string> {
  const pending = await homes.resetPending(provider);

  await writeFile(join(pending, 'record.json'), '{}', 'utf8');

  return pending;
}

beforeEach(async () => {
  userDataPath = await mkdtemp(join(tmpdir(), 'recompose-homes-'));
  homes = subscriptionHomes(userDataPath, process.platform);
});

describe('where a subscription account keeps its own config home', () => {
  test('given an account, its home sits under the app user data, apart from every other account', () => {
    const mine = homes.homeFor('anthropic', 'acc-one');
    const theirs = homes.homeFor('anthropic', 'acc-two');

    expect(mine).toBe(join(userDataPath, 'subscriptions', 'anthropic', 'acc-one'));
    expect(theirs).not.toBe(mine);
  });

  test('given a provider, one home holds the sign-in in progress', () => {
    expect(homes.pendingHomeFor('openai')).toBe(
      join(userDataPath, 'subscriptions', 'openai', 'pending'),
    );
  });

  test('given a Codex sign-in home, the seeded config keeps the credential in a file', async () => {
    const pending = await homes.resetPending('openai');

    const seeded = await readFile(join(pending, 'config.toml'), 'utf8');

    expect(seeded).toContain('cli_auth_credentials_store = "file"');
  });

  test('given a Claude Code sign-in home, nothing is seeded ahead of the tool', async () => {
    const pending = await homes.resetPending('anthropic');

    await expect(stands(join(pending, 'config.toml'))).resolves.toBe(false);
    await expect(stands(pending)).resolves.toBe(true);
  });

  test('given an abandoned sign-in, starting another one leaves nothing of the first behind', async () => {
    const first = await signedInAsPending('anthropic');

    await homes.resetPending('anthropic');

    await expect(stands(join(first, 'record.json'))).resolves.toBe(false);
  });

  test('given a finished sign-in, promoting it moves the whole home under the new account', async () => {
    const pending = await signedInAsPending('anthropic');

    const promoted = await homes.promotePending('anthropic', 'acc-one');

    expect(promoted).toBe(homes.homeFor('anthropic', 'acc-one'));
    await expect(readFile(join(promoted, 'record.json'), 'utf8')).resolves.toBe('{}');
    await expect(stands(pending)).resolves.toBe(false);
  });

  test('given an account being removed, its home goes with it, and removing twice still succeeds', async () => {
    await signedInAsPending('anthropic');
    const home = await homes.promotePending('anthropic', 'acc-one');

    await homes.removeHome('anthropic', 'acc-one');
    await homes.removeHome('anthropic', 'acc-one');

    await expect(stands(home)).resolves.toBe(false);
  });
});

describe('the pointer that names which account the tool answers to', () => {
  test('given no account yet, the pointer names nobody', async () => {
    await expect(homes.readActive('anthropic')).resolves.toBeNull();
  });

  test('given an account the pointer stands at, the pointer names it', async () => {
    await signedInAsPending('anthropic');
    await homes.promotePending('anthropic', 'acc-one');

    await homes.pointActiveAt('anthropic', 'acc-one');

    await expect(homes.readActive('anthropic')).resolves.toBe('acc-one');
  });

  test('given a pointer already standing, moving it names the account it moved to', async () => {
    await signedInAsPending('anthropic');
    await homes.promotePending('anthropic', 'acc-one');
    await signedInAsPending('anthropic');
    await homes.promotePending('anthropic', 'acc-two');
    await homes.pointActiveAt('anthropic', 'acc-one');

    await homes.pointActiveAt('anthropic', 'acc-two');

    await expect(homes.readActive('anthropic')).resolves.toBe('acc-two');
  });

  test('given a pointer whose home was taken out from under it, the pointer names nobody', async () => {
    await signedInAsPending('anthropic');
    await homes.promotePending('anthropic', 'acc-one');
    await homes.pointActiveAt('anthropic', 'acc-one');

    await rm(homes.homeFor('anthropic', 'acc-one'), { recursive: true, force: true });

    await expect(homes.readActive('anthropic')).resolves.toBeNull();
  });

  test('given each provider its own pointer, one provider never names another provider account', async () => {
    await signedInAsPending('anthropic');
    await homes.promotePending('anthropic', 'acc-one');
    await homes.pointActiveAt('anthropic', 'acc-one');

    await expect(homes.readActive('openai')).resolves.toBeNull();
  });
});

describe('healing the pointer after an account leaves', () => {
  test('given a pointer that still stands, the heal leaves it where it is', async () => {
    await signedInAsPending('anthropic');
    await homes.promotePending('anthropic', 'acc-one');
    await signedInAsPending('anthropic');
    await homes.promotePending('anthropic', 'acc-two');
    await homes.pointActiveAt('anthropic', 'acc-one');

    const settled = await homes.healActive('anthropic', ['acc-two', 'acc-one']);

    expect(settled).toBe('acc-one');
    await expect(homes.readActive('anthropic')).resolves.toBe('acc-one');
  });

  test('given the pointed-at account gone, the heal moves the pointer to a survivor', async () => {
    await signedInAsPending('anthropic');
    await homes.promotePending('anthropic', 'acc-one');
    await signedInAsPending('anthropic');
    await homes.promotePending('anthropic', 'acc-two');
    await homes.pointActiveAt('anthropic', 'acc-one');
    await homes.removeHome('anthropic', 'acc-one');

    const settled = await homes.healActive('anthropic', ['acc-two']);

    expect(settled).toBe('acc-two');
    await expect(homes.readActive('anthropic')).resolves.toBe('acc-two');
  });

  test('given the last account gone, the heal leaves no pointer standing', async () => {
    await signedInAsPending('anthropic');
    await homes.promotePending('anthropic', 'acc-one');
    await homes.pointActiveAt('anthropic', 'acc-one');
    await homes.removeHome('anthropic', 'acc-one');

    const settled = await homes.healActive('anthropic', []);

    expect(settled).toBeNull();
    await expect(stands(homes.activePointerFor('anthropic'))).resolves.toBe(false);
    await expect(homes.readActive('anthropic')).resolves.toBeNull();
  });
});
