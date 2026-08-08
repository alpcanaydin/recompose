import {
  ACCOUNTS_VERSION,
  GATEWAY_CONFIG_VERSION,
  type AccountsDocument,
  type EngineGateway,
  type GatewayConfig,
  type IpcResponse,
  type VirtualModel,
} from '@recompose/contracts';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { EngineHost } from '../engine-host/engine-host';
import type { StorageIpcContext } from './storage-context';

import { reversibleCodec } from '../storage/safe-storage-codec.testkit';
import { createEngineIpcHandlers } from './engine-ipc';
import { createStorageIpcHandlers } from './storage-ipc';

const MOVED_PORT = 9001;
const FIRST_PORT = 8397;

const registry: AccountsDocument = {
  schemaVersion: ACCOUNTS_VERSION,
  accounts: [
    { id: 'acc-key', provider: 'anthropic', kind: 'api-key', label: 'work', credentialRef: 'c1' },
  ],
};

const fast: VirtualModel = {
  id: 'fast',
  displayName: 'Fast',
  target: { accountId: 'acc-key', providerModel: 'claude-haiku-4-5' },
};

function codexServing(models: readonly VirtualModel[], port = FIRST_PORT): GatewayConfig {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug: 'codex',
    displayName: 'Codex',
    port,
    virtualModels: [...models],
    layout: { nodes: {} },
  };
}

type ProbePort = (taken: ReadonlySet<number>, installFolder: string) => Promise<number>;

async function deskOver(probeFreePort: ProbePort) {
  const serving = new Set<string>();
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-write-order-'));

  const context: StorageIpcContext = {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => reversibleCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: (gateway) => {
      serving.add(gateway.slug);
    },
    restartGateway: (gateway) => {
      serving.add(gateway.slug);
    },
    isServing: (slug) => serving.has(slug),
    releaseSubscription: async () => Promise.resolve({ ok: true }),
  };

  const host = {
    start: async (gateway: EngineGateway) => {
      serving.add(gateway.slug);

      return Promise.resolve({ status: 'running' as const });
    },
    stop: async () => Promise.resolve({ status: 'stopped' as const }),
    restart: async (gateway: EngineGateway) => {
      serving.add(gateway.slug);

      return Promise.resolve({ status: 'running' as const });
    },
    probe: async () => Promise.resolve({ verdict: 'could-not-check' as const }),
    probeRuntime: async () => Promise.resolve({ verdict: 'unreachable' as const }),
    listModels: async () => Promise.resolve({ standing: 'unlisted' as const }),
    states: () => ({}),
    onStatesChanged: () => () => undefined,
    dispose: () => undefined,
  } satisfies EngineHost;

  await writeFile(join(userDataPath, 'accounts.json'), JSON.stringify(registry), 'utf8');

  const storage = createStorageIpcHandlers(context);
  const engine = createEngineIpcHandlers({
    host,
    userDataPath,
    homeFolder: '/Users/ada',
    onCorrupt: () => undefined,
    probeFreePort,
  });

  await storage['gateways:save'](codexServing([]));

  return { storage, engine, userDataPath };
}

function landedList(answer: IpcResponse<'gateways:update'>): readonly GatewayConfig[] {
  if (!answer.ok) {
    throw new Error(`the write was refused: ${answer.error.message}`);
  }

  return answer.value;
}

async function storedCodex(storage: Awaited<ReturnType<typeof deskOver>>['storage']) {
  const listed = await storage['gateways:list'](undefined);

  if (!listed.ok) {
    throw new Error('the listing was refused');
  }

  return listed.value[0];
}

describe('an update and a move reaching the gateways directory together', () => {
  test('an update arriving inside a move keeps the definition and the moved port', async () => {
    const arrivedMidMove: Promise<IpcResponse<'gateways:update'>>[] = [];
    let desk: Awaited<ReturnType<typeof deskOver>> | undefined;

    desk = await deskOver(async () => {
      if (desk !== undefined && arrivedMidMove.length === 0) {
        arrivedMidMove.push(desk.storage['gateways:update'](codexServing([fast])));
      }

      return Promise.resolve(MOVED_PORT);
    });

    const moved = await desk.engine['gateways:move-port']({ slug: 'codex' });

    expect(moved.ok).toBe(true);
    expect(arrivedMidMove).toHaveLength(1);

    const [updated] = await Promise.all(arrivedMidMove);

    expect(updated === undefined ? [] : landedList(updated)).toHaveLength(1);

    const stored = await storedCodex(desk.storage);

    expect(stored?.port).toBe(MOVED_PORT);
    expect(stored?.virtualModels).toEqual([fast]);
  });

  test('a move arriving after an update carries the definition onto the new port', async () => {
    const desk = await deskOver(async () => Promise.resolve(MOVED_PORT));

    const updating = desk.storage['gateways:update'](codexServing([fast]));
    const moving = desk.engine['gateways:move-port']({ slug: 'codex' });

    const [updated, moved] = await Promise.all([updating, moving]);

    expect(landedList(updated)).toHaveLength(1);
    expect(moved.ok).toBe(true);

    const stored = await storedCodex(desk.storage);

    expect(stored?.port).toBe(MOVED_PORT);
    expect(stored?.virtualModels).toEqual([fast]);
  });

  test('neither write ever leaves the directory holding two documents for one gateway', async () => {
    const desk = await deskOver(async () => Promise.resolve(MOVED_PORT));

    await Promise.all([
      desk.storage['gateways:update'](codexServing([fast])),
      desk.engine['gateways:move-port']({ slug: 'codex' }),
    ]);

    const listed = await desk.storage['gateways:list'](undefined);

    expect(listed.ok && listed.value).toHaveLength(1);
  });
});
