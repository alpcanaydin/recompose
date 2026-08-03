import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { SubscriptionsIpcContext } from './subscriptions-ipc';

import { subscriptionHomes } from '../subscriptions/subscription-homes';
import { carriesAnyWindowOf } from './secret-windows.testkit';
import { createSubscriptionsIpcHandlers } from './subscriptions-ipc';

const tokenMaterial = 'sk-ant-oat01-verysecret-subscription-token';

async function aSignedInSubscription(): Promise<SubscriptionsIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-subs-hygiene-'));
  const homes = subscriptionHomes(userDataPath, process.platform);
  const pending = await homes.resetPending('anthropic');

  await writeFile(
    join(pending, '.credentials.json'),
    JSON.stringify({
      claudeAiOauth: {
        accessToken: tokenMaterial,
        refreshToken: `${tokenMaterial}-again`,
        subscriptionType: 'max',
      },
    }),
    'utf8',
  );
  await writeFile(
    join(pending, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'ada@example.com' } }),
    'utf8',
  );
  await homes.promotePending('anthropic', 'acc-one');
  await homes.pointActiveAt('anthropic', 'acc-one');
  await writeFile(
    join(userDataPath, 'accounts.json'),
    JSON.stringify({
      schemaVersion: 2,
      accounts: [
        { id: 'acc-one', provider: 'anthropic', kind: 'subscription', label: 'Claude Code' },
      ],
    }),
    'utf8',
  );

  return {
    userDataPath,
    homeFolder: '/Users/ada',
    platform: process.platform,
    custody: null,
    searchPath: async () => Promise.resolve(''),
    launch: async () => Promise.resolve(),
    clock: () => ({ elapsed: () => 0, sleep: async () => Promise.resolve() }),
    signInBoundMs: 0,
    signInEveryMs: 0,
    onCorrupt: () => undefined,
  };
}

function carriesNoTokenMaterial(answer: unknown): boolean {
  return !carriesAnyWindowOf(JSON.stringify(answer), tokenMaterial);
}

describe('subscription ipc handlers: no answer carries token material', () => {
  test('listing a signed-in subscription names its plan and its address, and no token', async () => {
    const handlers = createSubscriptionsIpcHandlers(await aSignedInSubscription());

    const answered = await handlers['subscriptions:list']();

    expect(answered).toMatchObject({
      ok: true,
      value: [{ standing: 'connected', plan: 'max', signedInAs: 'ada@example.com' }],
    });
    expect(carriesNoTokenMaterial(answered)).toBe(true);
  });

  test('activating a signed-in subscription answers without a token', async () => {
    const handlers = createSubscriptionsIpcHandlers(await aSignedInSubscription());

    const answered = await handlers['subscriptions:activate']({ id: 'acc-one' });

    expect(answered).toMatchObject({ ok: true, value: [{ active: true }] });
    expect(carriesNoTokenMaterial(answered)).toBe(true);
  });

  test('a refused restore names the tool rather than anything the tool holds', async () => {
    const handlers = createSubscriptionsIpcHandlers(await aSignedInSubscription());

    const answered = await handlers['subscriptions:restore']({ id: 'acc-one' });

    expect(answered).toMatchObject({ ok: false, error: { code: 'tool-missing' } });
    expect(carriesNoTokenMaterial(answered)).toBe(true);
  });
});
