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
    getCodec: plainCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    writeClipboard: () => undefined,
    applySettings: () => undefined,
  };
}

beforeEach(async () => {
  userDataPath = await mkdtemp(join(tmpdir(), 'recompose-vault-order-'));
});

afterEach(async () => {
  await rm(userDataPath, { recursive: true, force: true });
});

describe('two people writing the vault at once', () => {
  test('a token minted beside a connecting account loses neither secret', async () => {
    const handlers = createStorageIpcHandlers(context());

    const [connected, minted] = await Promise.all([
      handlers['accounts:connect']({
        provider: 'anthropic',
        kind: 'subscription',
        label: 'Claude Max',
        secret: 'not-a-real-secret',
      }),
      handlers['gateway-token:mint'](),
    ]);

    expect(connected.ok).toBe(true);
    expect(minted.ok).toBe(true);

    const token = await handlers['gateway-token:status']();
    const accounts = await handlers['accounts:list']();

    if (!token.ok || !accounts.ok || !connected.ok) {
      throw new Error('the vault could not report what it holds');
    }

    expect(token.value.masked).not.toBeNull();

    const stored = accounts.value.accounts.at(0);

    if (stored === undefined) {
      throw new Error('the account never landed');
    }

    const vault: unknown = JSON.parse(await readFile(join(userDataPath, 'vault.bin'), 'utf8'));

    expect(refsHeldIn(vault)).toEqual(['gateway-token', stored.credentialRef].toSorted());
  });
});
