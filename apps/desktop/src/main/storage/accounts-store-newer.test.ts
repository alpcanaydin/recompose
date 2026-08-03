import { ACCOUNTS_VERSION, defaultAccountsDocument } from '@recompose/contracts';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { AccountsNewerSchemaError, loadAccountsFile } from './accounts-store';
import { storedBootState } from './boot-state';
import { initializeStorage } from './initialize-storage';

const maxRow = {
  id: 'acc-1',
  provider: 'anthropic',
  kind: 'subscription',
  label: 'Max',
};

function documentNaming(schemaVersion: number): string {
  return JSON.stringify({
    schemaVersion,
    accounts: [maxRow],
    aFieldThisBuildNeverHeardOf: true,
  });
}

async function documentFrom(schemaVersion: number): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'recompose-accounts-newer-'));
  const file = join(dir, 'accounts.json');

  await writeFile(file, documentNaming(schemaVersion), 'utf8');

  return { dir, file };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('an accounts document written by a newer build', () => {
  test('reading it names the version rather than calling the file corrupt', async () => {
    const { file } = await documentFrom(ACCOUNTS_VERSION + 1);

    await expect(loadAccountsFile(file, () => undefined)).rejects.toThrow(AccountsNewerSchemaError);
  });

  test('every row stays on disk, so an older build never moves the registry aside', async () => {
    const { dir, file } = await documentFrom(ACCOUNTS_VERSION + 1);
    const quarantined: string[] = [];

    await loadAccountsFile(file, (path) => {
      quarantined.push(path);
    }).catch(() => undefined);

    expect(quarantined).toEqual([]);
    expect(await readdir(dir)).toEqual(['accounts.json']);
    expect(await readFile(file, 'utf8')).toBe(documentNaming(ACCOUNTS_VERSION + 1));
  });

  test('the failure carries the version the document names', async () => {
    const { file } = await documentFrom(ACCOUNTS_VERSION + 3);

    await expect(loadAccountsFile(file, () => undefined)).rejects.toMatchObject({
      schemaVersion: ACCOUNTS_VERSION + 3,
    });
  });

  test('a document at the supported version still reads', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'recompose-accounts-current-'));
    const file = join(dir, 'accounts.json');
    const held = { schemaVersion: ACCOUNTS_VERSION, accounts: [maxRow] };

    await writeFile(file, JSON.stringify(held), 'utf8');

    await expect(loadAccountsFile(file, () => undefined)).resolves.toEqual(held);
  });

  test('a document that is genuinely corrupt is still quarantined', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'recompose-accounts-corrupt-'));
    const file = join(dir, 'accounts.json');

    await writeFile(
      file,
      JSON.stringify({ schemaVersion: ACCOUNTS_VERSION, accounts: [{ ...maxRow, kind: 'oauth' }] }),
      'utf8',
    );

    const quarantined: string[] = [];

    const loaded = await loadAccountsFile(file, (path) => {
      quarantined.push(path);
    });

    expect(loaded).toEqual(defaultAccountsDocument());
    expect(quarantined).toHaveLength(1);
  });
});

describe('the boot read of an accounts document from a newer build', () => {
  test('the failure reaches the caller rather than becoming an empty registry', async () => {
    const { dir } = await documentFrom(ACCOUNTS_VERSION + 1);

    await expect(initializeStorage(dir, () => undefined)).rejects.toThrow(AccountsNewerSchemaError);
  });

  test('the window still opens, and the document is left where it stands', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { dir, file } = await documentFrom(ACCOUNTS_VERSION + 1);
    const quarantined: string[] = [];

    const booted = await storedBootState(dir, (path) => {
      quarantined.push(path);
    });

    expect(booted).toMatchObject({ slugs: [] });
    expect(quarantined).toEqual([]);
    expect(await readFile(file, 'utf8')).toBe(documentNaming(ACCOUNTS_VERSION + 1));
  });

  test('the refusal is written down under the name a reader can look up', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { dir } = await documentFrom(ACCOUNTS_VERSION + 1);

    await storedBootState(dir, () => undefined);

    expect(complaint.mock.calls.flat().map(String).join(' ')).toContain('AccountsNewerSchemaError');
  });
});
