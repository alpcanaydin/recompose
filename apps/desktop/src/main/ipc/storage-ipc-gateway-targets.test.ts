import type { Account, EngineGateway, GatewayConfig, IpcError } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { StorageIpcContext } from './storage-context';

import { gatewayHolding, keyRow, planRow, pointingAt } from '../engine-host/spend-grant.testkit';
import { reversibleCodec } from '../storage/safe-storage-codec.testkit';
import { createStorageIpcHandlers } from './storage-ipc';

type Desk = {
  served: EngineGateway[];
  userDataPath: string;
  handlers: ReturnType<typeof createStorageIpcHandlers>;
};

function contextHolding(
  userDataPath: string,
  served: EngineGateway[],
  serving: boolean,
): StorageIpcContext {
  return {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => reversibleCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: (gateway) => {
      served.push(gateway);
    },
    restartGateway: (gateway) => {
      served.push(gateway);
    },
    isServing: () => serving,
    releaseSubscription: async () => Promise.resolve({ ok: true }),
  };
}

async function deskWith(accounts: readonly Account[], stored: readonly GatewayConfig[]) {
  const served: EngineGateway[] = [];
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-targets-'));

  await writeFile(
    join(userDataPath, 'accounts.json'),
    JSON.stringify({ schemaVersion: ACCOUNTS_VERSION, accounts }),
    'utf8',
  );

  const handlers = createStorageIpcHandlers(contextHolding(userDataPath, served, true));

  for (const gateway of stored) {
    await handlers['gateways:save'](gateway);
  }

  served.length = 0;

  return { served, userDataPath, handlers } satisfies Desk;
}

function refusalIn(answer: { ok: true } | { ok: false; error: IpcError }): IpcError {
  if (answer.ok) {
    throw new Error('the write landed where the spec expected a refusal');
  }

  return answer.error;
}

async function storedSlugs(userDataPath: string): Promise<string[]> {
  return readdir(join(userDataPath, 'gateways'), { withFileTypes: false }).catch(() => []);
}

const bindingASubscription = gatewayHolding([pointingAt(planRow.id)]);

const bindingAKey = gatewayHolding([pointingAt(keyRow.id)]);

describe('a save carrying a definition bound to a subscription account', () => {
  test('the save is refused rather than stored', async () => {
    const desk = await deskWith([keyRow, planRow], []);

    const answer = await desk.handlers['gateways:save'](bindingASubscription);

    expect(refusalIn(answer).code).toBe('validation-failed');
  });

  test('the refusal names the subscription target it refused', async () => {
    const desk = await deskWith([keyRow, planRow], []);

    const answer = await desk.handlers['gateways:save'](bindingASubscription);

    expect(refusalIn(answer).message).toContain(planRow.label);
    expect(refusalIn(answer).message).toContain('subscription');
  });

  test('a refused save leaves no document behind and serves nothing', async () => {
    const desk = await deskWith([keyRow, planRow], []);

    await desk.handlers['gateways:save'](bindingASubscription);

    await expect(storedSlugs(desk.userDataPath)).resolves.toStrictEqual([]);
    expect(desk.served).toStrictEqual([]);
  });

  test('a definition bound to a key account still stores and serves', async () => {
    const desk = await deskWith([keyRow, planRow], []);

    const answer = await desk.handlers['gateways:save'](bindingAKey);

    expect(answer).toMatchObject({ ok: true });
    expect(desk.served[0]?.virtualModels).toStrictEqual([
      {
        id: 'fast',
        displayName: 'fast',
        target: { standing: 'bound', providerModel: 'claude-sonnet-5' },
      },
    ]);
  });
});

function blanklyNamed(accountId: string): GatewayConfig {
  return gatewayHolding([
    { id: 'fast', displayName: '   ', target: { accountId, providerModel: 'claude-sonnet-5' } },
  ]);
}

describe('a save the stored shape itself refuses', () => {
  test('a blank name bound to a key account is refused in the schema own words', async () => {
    const desk = await deskWith([keyRow, planRow], []);

    const answer = await desk.handlers['gateways:save'](blanklyNamed(keyRow.id));

    expect(refusalIn(answer).code).toBe('validation-failed');
    expect(refusalIn(answer).message).not.toContain('subscription');
    expect(refusalIn(answer).message).not.toContain(keyRow.label);
  });

  test('a blank name bound to an account nothing holds is refused the same way', async () => {
    const desk = await deskWith([keyRow, planRow], []);

    const answer = await desk.handlers['gateways:save'](blanklyNamed('acc-vanished'));

    expect(refusalIn(answer).code).toBe('validation-failed');
    expect(refusalIn(answer).message).not.toContain('subscription');
  });
});

describe('an update carrying a definition bound to a subscription account', () => {
  test('the update is refused rather than rewritten', async () => {
    const desk = await deskWith([keyRow, planRow], [gatewayHolding([])]);

    const answer = await desk.handlers['gateways:update'](bindingASubscription);

    expect(refusalIn(answer).code).toBe('validation-failed');
    expect(refusalIn(answer).message).toContain(planRow.label);
  });

  test('a refused update leaves the stored document exactly as it stood', async () => {
    const desk = await deskWith([keyRow, planRow], [gatewayHolding([])]);

    await desk.handlers['gateways:update'](bindingASubscription);

    await expect(desk.handlers['gateways:list'](undefined)).resolves.toStrictEqual({
      ok: true,
      value: [gatewayHolding([])],
    });
    expect(desk.served).toStrictEqual([]);
  });

  test('an update binding a key account rewrites the document', async () => {
    const desk = await deskWith([keyRow, planRow], [gatewayHolding([])]);

    const answer = await desk.handlers['gateways:update'](bindingAKey);

    expect(answer).toMatchObject({ ok: true, value: [bindingAKey] });
  });
});
