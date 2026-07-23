import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

async function freshVaultFile(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), 'recompose-vault-')), 'vault.bin');
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

describe('loading a vault file', () => {
  test('an absent vault file loads as the empty vault', async () => {
    const file = await freshVaultFile();

    expect(await loadVaultFile(file, () => undefined)).toEqual({ schemaVersion: 1, entries: {} });
  });

  test('a vault file whose contents are not an object loads as the empty vault', async () => {
    const file = await freshVaultFile();

    await writeFile(file, JSON.stringify('not-a-vault'), 'utf8');

    expect(await loadVaultFile(file, () => undefined)).toEqual({ schemaVersion: 1, entries: {} });
  });

  test('a vault file holding null loads as the empty vault', async () => {
    const file = await freshVaultFile();

    await writeFile(file, JSON.stringify(null), 'utf8');

    expect(await loadVaultFile(file, () => undefined)).toEqual({ schemaVersion: 1, entries: {} });
  });

  test('a vault file with an unrecognised schema version loads as the empty vault', async () => {
    const file = await freshVaultFile();

    await writeFile(file, JSON.stringify({ schemaVersion: 2, entries: {} }), 'utf8');

    expect(await loadVaultFile(file, () => undefined)).toEqual({ schemaVersion: 1, entries: {} });
  });

  test('a vault file whose entries are not a record loads as the empty vault', async () => {
    const file = await freshVaultFile();

    await writeFile(file, JSON.stringify({ schemaVersion: 1, entries: 'nope' }), 'utf8');

    expect(await loadVaultFile(file, () => undefined)).toEqual({ schemaVersion: 1, entries: {} });
  });
});
