import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { StorageIpcContext } from './storage-context';

import { createStorageIpcHandlers } from './storage-ipc';

function asRecord(value: unknown, missing: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error(missing);
  }

  return { ...value };
}

function refsHeldIn(document: unknown): string[] {
  const held = asRecord(document, 'the vault file is not a document');

  return Object.keys(asRecord(held['entries'], 'the vault holds no entries')).toSorted();
}

let userDataPath = '';

function plainCodec() {
  return {
    encrypt: (plain: string) => Buffer.from(plain).toString('base64'),
    decrypt: (encoded: string) => Buffer.from(encoded, 'base64').toString(),
    isPlaintextFallback: false,
  };
}

function context(): StorageIpcContext {
  return {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: plainCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: () => undefined,
    releaseSubscription: async () => Promise.resolve({ ok: true }),
  };
}

beforeEach(async () => {
  userDataPath = await mkdtemp(join(tmpdir(), 'recompose-vault-order-'));
});

afterEach(async () => {
  await rm(userDataPath, { recursive: true, force: true });
});

describe('two people writing the vault at once', () => {
  test('two accounts connecting together lose neither secret', async () => {
    const handlers = createStorageIpcHandlers(context());

    const [first, second] = await Promise.all([
      handlers['accounts:connect']({
        provider: 'openrouter',
        kind: 'aggregator',
        label: 'Router',
        secret: 'not-a-real-secret',
      }),
      handlers['accounts:connect']({
        provider: 'anthropic',
        kind: 'api-key',
        label: 'Work',
        secret: 'also-not-a-real-secret',
      }),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    const accounts = await handlers['accounts:list']();

    if (!accounts.ok) {
      throw new Error('the vault could not report what it holds');
    }

    const refs = accounts.value.accounts.flatMap((stored) =>
      stored.kind === 'api-key' || stored.kind === 'aggregator' ? [stored.credentialRef] : [],
    );

    expect(refs).toHaveLength(2);

    const vault: unknown = JSON.parse(await readFile(join(userDataPath, 'vault.bin'), 'utf8'));

    expect(refsHeldIn(vault)).toEqual(refs.toSorted());
  });
});
