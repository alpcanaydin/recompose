import {
  ACCOUNTS_VERSION,
  GATEWAY_CONFIG_VERSION,
  type AccountsDocument,
  type EngineGateway,
  type GatewayConfig,
  type VirtualModel,
} from '@recompose/contracts';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { StorageIpcContext } from './storage-context';

import { storedEngineGateway } from '../engine-host/stored-gateway';
import { reversibleCodec } from '../storage/safe-storage-codec.testkit';
import { createStorageIpcHandlers } from './storage-ipc';

const registry: AccountsDocument = {
  schemaVersion: ACCOUNTS_VERSION,
  accounts: [
    { id: 'acc-key', provider: 'anthropic', kind: 'api-key', label: 'work', credentialRef: 'c1' },
    { id: 'acc-plan', provider: 'anthropic', kind: 'subscription', label: 'Max' },
  ],
};

const fast: VirtualModel = {
  id: 'fast',
  displayName: 'Fast',
  target: { accountId: 'acc-key', providerModel: 'claude-haiku-4-5' },
};

const fastBound = {
  id: 'fast',
  displayName: 'Fast',
  target: { standing: 'bound', providerModel: 'claude-haiku-4-5' },
};

function gatewayServing(models: readonly VirtualModel[]): GatewayConfig {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug: 'codex',
    displayName: 'Codex',
    port: 8397,
    virtualModels: [...models],
    layout: { nodes: {} },
  };
}

async function deskHolding(stored: readonly GatewayConfig[]) {
  const started: EngineGateway[] = [];
  const restarted: EngineGateway[] = [];
  const stopped = new Set<string>();
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-serving-'));
  const context: StorageIpcContext = {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => reversibleCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: (gateway) => {
      started.push(gateway);
    },
    restartGateway: (gateway) => {
      restarted.push(gateway);
    },
    isServing: (slug) => !stopped.has(slug),
    releaseSubscription: async () => Promise.resolve({ ok: true }),
  };

  await writeFile(join(userDataPath, 'accounts.json'), JSON.stringify(registry), 'utf8');

  const handlers = createStorageIpcHandlers(context);

  for (const gateway of stored) {
    await handlers['gateways:save'](gateway);
  }

  started.length = 0;

  return {
    started,
    restarted,
    stopped,
    handlers,
    /** What a later manual start would hand the engine, read from the stored document. */
    startStored: async (slug: string) => {
      const serving = await storedEngineGateway(userDataPath, () => undefined, slug);

      if (serving === undefined) {
        throw new Error(`no gateway is stored under ${slug}`);
      }

      return serving.virtualModels;
    },
  };
}

describe('what a rewrite asks the engine for', () => {
  test('a gateway already serving is handed the fresh snapshot at once', async () => {
    const desk = await deskHolding([gatewayServing([])]);

    await desk.handlers['gateways:update'](gatewayServing([fast]));

    expect(desk.restarted).toEqual([
      { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [fastBound] },
    ]);
    expect(desk.started).toEqual([]);
  });

  test('a target the registry resolved as gone is handed over as removed, not as bound', async () => {
    const desk = await deskHolding([gatewayServing([])]);
    const orphan: VirtualModel = {
      id: 'gone',
      displayName: 'Gone',
      target: { accountId: 'acc-vanished', providerModel: 'claude-opus-5' },
    };

    await desk.handlers['gateways:update'](gatewayServing([orphan]));

    expect(desk.restarted[0]?.virtualModels).toEqual([
      { id: 'gone', displayName: 'Gone', target: { standing: 'removed' } },
    ]);
  });
});

describe('a rewrite of a gateway a person stopped', () => {
  test('the document is rewritten and the gateway is left stopped', async () => {
    const desk = await deskHolding([gatewayServing([])]);

    desk.stopped.add('codex');

    const answer = await desk.handlers['gateways:update'](gatewayServing([fast]));

    expect(answer).toEqual({ ok: true, value: [gatewayServing([fast])] });
    expect(desk.restarted).toEqual([]);
    expect(desk.started).toEqual([]);
  });

  test('the next start serves the definition the rewrite stored', async () => {
    const desk = await deskHolding([gatewayServing([])]);

    desk.stopped.add('codex');
    await desk.handlers['gateways:update'](gatewayServing([fast]));

    await expect(desk.startStored('codex')).resolves.toEqual([fastBound]);
  });
});
