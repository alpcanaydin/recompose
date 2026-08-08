import {
  ACCOUNTS_VERSION,
  GATEWAY_CONFIG_VERSION,
  type AccountsDocument,
  type EngineGateway,
  type GatewayConfig,
  type IpcError,
  type VirtualModel,
} from '@recompose/contracts';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { StorageIpcContext } from './storage-context';

import { createStorageIpcHandlers } from './storage-ipc';

const fakeCodec: SecretCodec = {
  encrypt: (plain) => Buffer.from(plain, 'utf8').toString('base64'),
  decrypt: (encrypted) => Buffer.from(encrypted, 'base64').toString('utf8'),
  isPlaintextFallback: false,
};

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

function gatewayServing(models: readonly VirtualModel[], port = 8397): GatewayConfig {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug: 'codex',
    displayName: 'Codex',
    port,
    virtualModels: [...models],
    layout: { nodes: {} },
  };
}

type Desk = {
  restarted: EngineGateway[];
  userDataPath: string;
  handlers: ReturnType<typeof createStorageIpcHandlers>;
};

async function deskHolding(stored: readonly GatewayConfig[]): Promise<Desk> {
  const started: EngineGateway[] = [];
  const restarted: EngineGateway[] = [];
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-update-'));
  const context: StorageIpcContext = {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => fakeCodec,
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
    isServing: () => true,
    releaseSubscription: async () => Promise.resolve({ ok: true }),
  };

  await writeFile(join(userDataPath, 'accounts.json'), JSON.stringify(registry), 'utf8');

  const handlers = createStorageIpcHandlers(context);

  for (const gateway of stored) {
    await handlers['gateways:save'](gateway);
  }

  started.length = 0;

  return { restarted, userDataPath, handlers };
}

function refusalIn(answer: { ok: true } | { ok: false; error: IpcError }): IpcError {
  if (answer.ok) {
    throw new Error('the update landed where the spec expected a refusal');
  }

  return answer.error;
}

async function storedBytes(userDataPath: string, slug: string): Promise<string> {
  return readFile(join(userDataPath, 'gateways', `${slug}.json`), 'utf8');
}

describe('an update to a gateway already on disk', () => {
  test('the definition a person added reaches the stored document', async () => {
    const desk = await deskHolding([gatewayServing([])]);

    const answer = await desk.handlers['gateways:update'](gatewayServing([fast]));

    expect(answer).toEqual({ ok: true, value: [gatewayServing([fast])] });
  });

  test('the rewritten document is what a later read answers with', async () => {
    const desk = await deskHolding([gatewayServing([])]);

    await desk.handlers['gateways:update'](gatewayServing([fast]));

    await expect(desk.handlers['gateways:list'](undefined)).resolves.toEqual({
      ok: true,
      value: [gatewayServing([fast])],
    });
  });
});

describe('an update nothing can stand on', () => {
  test('a slug nothing is stored under is refused rather than created', async () => {
    const desk = await deskHolding([]);

    const answer = await desk.handlers['gateways:update'](gatewayServing([fast]));

    expect(refusalIn(answer).code).toBe('storage-failed');
    expect(refusalIn(answer).message).toContain('codex');
  });

  test('a refused update writes no document and asks the engine for nothing', async () => {
    const desk = await deskHolding([]);

    await desk.handlers['gateways:update'](gatewayServing([fast]));

    await expect(desk.handlers['gateways:list'](undefined)).resolves.toEqual({
      ok: true,
      value: [],
    });
    expect(desk.restarted).toEqual([]);
  });

  test('a slug nobody holds is refused even while another gateway stands beside it', async () => {
    const desk = await deskHolding([gatewayServing([])]);
    const stranger = { ...gatewayServing([fast]), slug: 'gemini', displayName: 'Gemini' };

    const answer = await desk.handlers['gateways:update'](stranger);

    expect(refusalIn(answer).code).toBe('storage-failed');
    expect(refusalIn(answer).message).toContain('gemini');
    await expect(desk.handlers['gateways:list'](undefined)).resolves.toEqual({
      ok: true,
      value: [gatewayServing([])],
    });
  });

  test('a registry no build can read leaves the stored document exactly as it stood', async () => {
    const desk = await deskHolding([gatewayServing([])]);
    const before = await storedBytes(desk.userDataPath, 'codex');

    await writeFile(
      join(desk.userDataPath, 'accounts.json'),
      JSON.stringify({ schemaVersion: ACCOUNTS_VERSION + 1, accounts: [] }),
      'utf8',
    );

    const answer = await desk.handlers['gateways:update'](gatewayServing([fast]));

    expect(answer).toMatchObject({ ok: false, error: { code: 'accounts-newer-schema' } });
    expect(await storedBytes(desk.userDataPath, 'codex')).toBe(before);
    expect(desk.restarted).toEqual([]);
  });
});

describe('a gateways directory no build can read', () => {
  test('a document a newer build wrote refuses the listing rather than answering none', async () => {
    const desk = await deskHolding([gatewayServing([])]);

    await writeFile(
      join(desk.userDataPath, 'gateways', 'codex.json'),
      JSON.stringify({ ...gatewayServing([]), schemaVersion: GATEWAY_CONFIG_VERSION + 1 }),
      'utf8',
    );

    await expect(desk.handlers['gateways:list'](undefined)).resolves.toMatchObject({
      ok: false,
      error: { code: 'storage-failed' },
    });
  });
});

describe('a port arriving through an update', () => {
  test('the stored port stands, because the move lane owns ports and this one does not', async () => {
    const desk = await deskHolding([gatewayServing([])]);

    const answer = await desk.handlers['gateways:update'](gatewayServing([fast], 9001));

    expect(answer).toEqual({ ok: true, value: [gatewayServing([fast])] });
  });

  test('the answer corrects the caller rather than storing the port it sent', async () => {
    const desk = await deskHolding([gatewayServing([])]);

    await desk.handlers['gateways:update'](gatewayServing([fast], 9001));

    const stored = await storedBytes(desk.userDataPath, 'codex');

    expect(JSON.parse(stored)).toMatchObject({ port: 8397, virtualModels: [fast] });
    expect(desk.restarted[0]?.port).toBe(8397);
  });
});

describe('an update beside a save', () => {
  test('two writes arriving at once take the gateways directory one at a time', async () => {
    const desk = await deskHolding([gatewayServing([])]);
    const gemini = { ...gatewayServing([]), slug: 'gemini', displayName: 'Gemini', port: 8398 };

    const [updated, saved] = await Promise.all([
      desk.handlers['gateways:update'](gatewayServing([fast])),
      desk.handlers['gateways:save'](gemini),
    ]);

    expect(updated.ok).toBe(true);
    expect(saved.ok).toBe(true);

    await expect(desk.handlers['gateways:list'](undefined)).resolves.toEqual({
      ok: true,
      value: [gatewayServing([fast]), gemini],
    });
  });
});
