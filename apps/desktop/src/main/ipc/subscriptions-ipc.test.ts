import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';

import type { SubscriptionsWorld } from './subscriptions-ipc.testkit';

import { PARKED_SERVICE } from '../subscriptions/credential-custody';
import { createSubscriptionsIpcHandlers } from './subscriptions-ipc';
import { aFreshWorld, viewsIn } from './subscriptions-ipc.testkit';

let world: SubscriptionsWorld;

function handlersOn(platform: NodeJS.Platform = 'linux') {
  return createSubscriptionsIpcHandlers(world.contextOn(platform, world.nothingHappens));
}

async function aClaudeCodeHomeUnder(id: string, address: string, plan: string): Promise<void> {
  const homes = world.homesOn('linux');
  const pending = homes.pendingHomeFor('anthropic');

  await homes.resetPending('anthropic');
  await writeFile(
    join(pending, '.credentials.json'),
    JSON.stringify({ claudeAiOauth: { subscriptionType: plan } }),
    'utf8',
  );
  await writeFile(
    join(pending, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: address } }),
    'utf8',
  );
  await homes.promotePending('anthropic', id);
  await homes.pointActiveAt('anthropic', id);
}

async function aCodexHomeUnder(id: string): Promise<void> {
  const homes = world.homesOn('linux');
  const pending = homes.pendingHomeFor('openai');

  await homes.resetPending('openai');
  await writeFile(join(pending, 'auth.json'), JSON.stringify({ tokens: {} }), 'utf8');
  await homes.promotePending('openai', id);
}

async function anAnthropicRow(): Promise<void> {
  await world.alreadyHolding([
    { id: 'acc-one', provider: 'anthropic', kind: 'subscription', label: 'Ada' },
  ]);
}

beforeEach(async () => {
  world = await aFreshWorld();
});

describe('listing the subscription accounts a person holds', () => {
  test('given no accounts at all, the list is empty', async () => {
    const answered = await handlersOn()['subscriptions:list']();

    expect(answered).toEqual({ ok: true, value: [] });
  });

  test('given a pasted-key account beside a subscription, only the subscription is listed', async () => {
    await world.alreadyHolding([
      { id: 'acc-one', provider: 'anthropic', kind: 'subscription', label: 'Claude Code' },
      {
        id: 'acc-two',
        provider: 'openrouter',
        kind: 'api-key',
        label: 'OpenRouter',
        credentialRef: 'cred-two',
      },
    ]);

    const answered = await handlersOn()['subscriptions:list']();

    expect(viewsIn(answered).map((view) => view.id)).toEqual(['acc-one']);
  });

  test('given a signed-in account, the row carries who it signs in as, its plan, and its standing', async () => {
    await aClaudeCodeHomeUnder('acc-one', 'ada@ex.com', 'max');
    await world.alreadyHolding([
      { id: 'acc-one', provider: 'anthropic', kind: 'subscription', label: 'Ada' },
    ]);

    const answered = await handlersOn()['subscriptions:list']();

    expect(viewsIn(answered)).toEqual([
      {
        id: 'acc-one',
        provider: 'anthropic',
        label: 'Ada',
        signedInAs: 'ada@ex.com',
        plan: 'max',
        standing: 'connected',
        active: true,
      },
    ]);
  });

  test('given an account whose home holds no credential, the row reads as lapsed and inactive', async () => {
    await world.alreadyHolding([
      { id: 'acc-one', provider: 'openai', kind: 'subscription', label: 'Codex' },
    ]);

    const answered = await handlersOn()['subscriptions:list']();

    expect(viewsIn(answered)[0]).toMatchObject({ standing: 'lapsed', active: false });
  });
});

describe('a row reads connected only where a credential stands', () => {
  test('given a Codex account signed in, the row carries no address and no plan', async () => {
    await aCodexHomeUnder('acc-one');
    await world.alreadyHolding([
      { id: 'acc-one', provider: 'openai', kind: 'subscription', label: 'Codex' },
    ]);

    const [view] = viewsIn(await handlersOn()['subscriptions:list']());

    expect(view).toMatchObject({ standing: 'connected' });
    expect(Object.keys(view ?? {}).sort()).toEqual([
      'active',
      'id',
      'label',
      'provider',
      'standing',
    ]);
  });

  test('given the credential parked in the keychain, the row reads connected on a bare home', async () => {
    await anAnthropicRow();
    world.keychain.put(PARKED_SERVICE, 'acc-one', 'opaque');

    const [view] = viewsIn(await handlersOn('darwin')['subscriptions:list']());

    expect(view).toMatchObject({ standing: 'connected' });
  });

  test('given no credential in the home and none in the keychain, the row reads lapsed', async () => {
    await anAnthropicRow();

    const [view] = viewsIn(await handlersOn('darwin')['subscriptions:list']());

    expect(view).toMatchObject({ standing: 'lapsed' });
  });
});

describe('reporting the provider tools this machine can run', () => {
  test('given one tool installed, the report tells the two apart', async () => {
    await world.toolInstalled('claude');

    const answered = await handlersOn()['subscriptions:tools']();

    expect(answered.ok && answered.value.map((tool) => [tool.provider, tool.present])).toEqual([
      ['anthropic', true],
      ['openai', false],
    ]);
  });
});
