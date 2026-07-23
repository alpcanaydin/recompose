import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { SecretCodec } from './safe-storage-codec';

import { deleteSecret, getSecret, loadVaultFile, saveVaultFile, setSecret } from './vault';

const reverseCodec: SecretCodec = {
  encrypt: (plain) => Buffer.from(plain.split('').reverse().join('')).toString('base64'),
  decrypt: (encrypted) =>
    Buffer.from(encrypted, 'base64').toString('utf8').split('').reverse().join(''),
  isPlaintextFallback: false,
};

async function freshVaultDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'recompose-vault-'));
}

async function freshVaultFile(): Promise<string> {
  return join(await freshVaultDir(), 'vault.bin');
}

describe('secret vault', () => {
  test('a stored secret round-trips through the codec', () => {
    const vault = setSecret({ schemaVersion: 1, entries: {} }, reverseCodec, 'cred-1', 'sk-abc');

    expect(getSecret(vault, reverseCodec, 'cred-1')).toBe('sk-abc');
  });

  test('the plaintext never appears in the persisted file', async () => {
    const file = await freshVaultFile();
    const vault = setSecret(
      { schemaVersion: 1, entries: {} },
      reverseCodec,
      'cred-1',
      'sk-topsecret',
    );

    await saveVaultFile(file, vault);

    expect(await readFile(file, 'utf8')).not.toContain('sk-topsecret');
  });

  test('a saved vault loads back and still decrypts', async () => {
    const file = await freshVaultFile();

    await saveVaultFile(
      file,
      setSecret({ schemaVersion: 1, entries: {} }, reverseCodec, 'r', 'value'),
    );

    const loaded = await loadVaultFile(file, () => undefined);

    expect(getSecret(loaded, reverseCodec, 'r')).toBe('value');
  });

  test('deleting a secret removes only that entry', () => {
    let vault = setSecret({ schemaVersion: 1, entries: {} }, reverseCodec, 'a', '1');

    vault = setSecret(vault, reverseCodec, 'b', '2');

    const after = deleteSecret(vault, 'a');

    expect(getSecret(after, reverseCodec, 'a')).toBeUndefined();
    expect(getSecret(after, reverseCodec, 'b')).toBe('2');
  });
});

describe('loading an absent or well-formed vault file', () => {
  test('an absent vault file loads as the empty vault', async () => {
    const file = await freshVaultFile();

    expect(await loadVaultFile(file, () => undefined)).toEqual({ schemaVersion: 1, entries: {} });
  });
});

describe('loading a structurally invalid vault file', () => {
  async function expectQuarantined(dir: string, file: string): Promise<void> {
    const seen: string[] = [];

    const loaded = await loadVaultFile(file, (p) => seen.push(p));

    expect(loaded).toEqual({ schemaVersion: 1, entries: {} });
    expect(seen).toHaveLength(1);
    const entries = await readdir(dir);

    expect(entries).toEqual([expect.stringMatching(/^vault\.bin\.corrupt-/)]);
  }

  test('a vault file whose contents are not an object is quarantined', async () => {
    const dir = await freshVaultDir();
    const file = join(dir, 'vault.bin');

    await writeFile(file, JSON.stringify('not-a-vault'), 'utf8');

    await expectQuarantined(dir, file);
  });

  test('a vault file holding null is quarantined', async () => {
    const dir = await freshVaultDir();
    const file = join(dir, 'vault.bin');

    await writeFile(file, JSON.stringify(null), 'utf8');

    await expectQuarantined(dir, file);
  });

  test('a vault file missing schemaVersion entirely is quarantined', async () => {
    const dir = await freshVaultDir();
    const file = join(dir, 'vault.bin');

    await writeFile(file, JSON.stringify({ entries: {} }), 'utf8');

    await expectQuarantined(dir, file);
  });

  test('a vault file whose entries are not a record is quarantined', async () => {
    const dir = await freshVaultDir();
    const file = join(dir, 'vault.bin');

    await writeFile(file, JSON.stringify({ schemaVersion: 1, entries: 'nope' }), 'utf8');

    await expectQuarantined(dir, file);
  });

  test('a vault file whose entries hold a non-string value is quarantined', async () => {
    const dir = await freshVaultDir();
    const file = join(dir, 'vault.bin');

    await writeFile(file, JSON.stringify({ schemaVersion: 1, entries: { a: 5 } }), 'utf8');

    await expectQuarantined(dir, file);
  });
});

describe('loading a vault file from a newer app version', () => {
  test('a newer schemaVersion throws instead of emptying the vault', async () => {
    const dir = await freshVaultDir();
    const file = join(dir, 'vault.bin');

    await writeFile(file, JSON.stringify({ schemaVersion: 2, entries: {} }), 'utf8');

    await expect(loadVaultFile(file, () => undefined)).rejects.toThrow(/newer/);
    expect(await readdir(dir)).toEqual(['vault.bin']);
  });
});
