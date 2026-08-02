import {
  GATEWAY_CONFIG_VERSION,
  type EngineGateway,
  type GatewayConfig,
  type IpcError,
} from '@recompose/contracts';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
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

function gatewayNamed(slug: string, displayName: string, port: number): GatewayConfig {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug,
    displayName,
    port,
    virtualModels: [],
    layout: { nodes: {} },
  };
}

async function freshContext(started: EngineGateway[]): Promise<StorageIpcContext> {
  return {
    userDataPath: await mkdtemp(join(tmpdir(), 'recompose-conflicts-')),
    homeFolder: '/Users/ada',
    getCodec: () => fakeCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: (gateway) => {
      started.push(gateway);
    },
    releaseSubscription: async () => Promise.resolve({ ok: true }),
  };
}

function refusalIn(answer: { ok: true } | { ok: false; error: IpcError }): IpcError {
  if (answer.ok) {
    throw new Error('the save landed where the spec expected a refusal');
  }

  return answer.error;
}

async function bytesOf(userDataPath: string, slug: string): Promise<string> {
  return readFile(join(userDataPath, 'gateways', `${slug}.json`), 'utf8');
}

const codex = gatewayNamed('codex', 'Codex', 8397);

describe('a save that collides with a stored gateway', () => {
  test('a name a stored gateway holds is refused rather than overwritten', async () => {
    const context = await freshContext([]);
    const handlers = createStorageIpcHandlers(context);

    await handlers['gateways:save'](codex);
    const answer = await handlers['gateways:save'](gatewayNamed('codex', 'Codex', 9001));

    expect(refusalIn(answer).code).toBe('name-conflict');
    expect(refusalIn(answer).message).toContain('Codex');
  });

  test('two names deriving one slug collide, because one file can hold only one gateway', async () => {
    const context = await freshContext([]);
    const handlers = createStorageIpcHandlers(context);

    await handlers['gateways:save'](codex);
    const answer = await handlers['gateways:save'](gatewayNamed('codex', 'codex', 9001));

    expect(refusalIn(answer).code).toBe('name-conflict');
  });

  test('the stored document survives a name collision byte for byte', async () => {
    const context = await freshContext([]);
    const handlers = createStorageIpcHandlers(context);

    await handlers['gateways:save'](codex);
    const before = await bytesOf(context.userDataPath, 'codex');

    await handlers['gateways:save'](gatewayNamed('codex', 'Impostor', 9001));

    expect(await bytesOf(context.userDataPath, 'codex')).toBe(before);
  });

  test('a port a stored gateway holds is refused, and the message names the holder', async () => {
    const context = await freshContext([]);
    const handlers = createStorageIpcHandlers(context);

    await handlers['gateways:save'](codex);
    const answer = await handlers['gateways:save'](gatewayNamed('gemini', 'Gemini', 8397));

    expect(refusalIn(answer).code).toBe('port-conflict');
    expect(refusalIn(answer).message).toBe('codex already holds this port.');
  });

  test('a refused port collision writes no second document', async () => {
    const context = await freshContext([]);
    const handlers = createStorageIpcHandlers(context);

    await handlers['gateways:save'](codex);
    await handlers['gateways:save'](gatewayNamed('gemini', 'Gemini', 8397));

    await expect(handlers['gateways:list'](undefined)).resolves.toEqual({
      ok: true,
      value: [codex],
    });
  });
});

describe('two saves arriving at once', () => {
  test('a port only one of them can have is refused for the other', async () => {
    const ctx = await freshContext([]);
    const handlers = createStorageIpcHandlers(ctx);

    const [first, second] = await Promise.all([
      handlers['gateways:save'](gatewayNamed('codex', 'Codex', 8397)),
      handlers['gateways:save'](gatewayNamed('claude', 'Claude', 8397)),
    ]);

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
  });

  test('only one document reaches the disk, so no port is handed out twice', async () => {
    const ctx = await freshContext([]);
    const handlers = createStorageIpcHandlers(ctx);

    await Promise.all([
      handlers['gateways:save'](gatewayNamed('codex', 'Codex', 8397)),
      handlers['gateways:save'](gatewayNamed('claude', 'Claude', 8397)),
    ]);

    const stored = await readdir(join(ctx.userDataPath, 'gateways'));

    expect(stored).toHaveLength(1);
  });
});

describe('what a save asks the engine for', () => {
  test('a stored gateway is handed to the engine to serve at once', async () => {
    const started: EngineGateway[] = [];
    const handlers = createStorageIpcHandlers(await freshContext(started));

    await handlers['gateways:save'](codex);

    expect(started).toEqual([{ slug: 'codex', displayName: 'Codex', port: 8397 }]);
  });

  test('a refused save asks the engine for nothing', async () => {
    const started: EngineGateway[] = [];
    const handlers = createStorageIpcHandlers(await freshContext(started));

    await handlers['gateways:save'](codex);
    await handlers['gateways:save'](gatewayNamed('codex', 'Codex', 9001));

    expect(started).toEqual([{ slug: 'codex', displayName: 'Codex', port: 8397 }]);
  });

  test('a gateway on a free slug and a free port joins the list and serves', async () => {
    const started: EngineGateway[] = [];
    const handlers = createStorageIpcHandlers(await freshContext(started));
    const gemini = gatewayNamed('gemini', 'Gemini', 8398);

    await handlers['gateways:save'](codex);
    const answer = await handlers['gateways:save'](gemini);

    expect(answer).toEqual({ ok: true, value: [codex, gemini] });
    expect(started.map((gateway) => gateway.slug)).toEqual(['codex', 'gemini']);
  });
});
