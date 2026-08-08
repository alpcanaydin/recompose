import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { AccountsFileWatcher } from './accounts-file-watcher';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe('AccountsFileWatcher reading the accounts file from disk', () => {
  it('should wait quietly for an accounts file that does not exist yet', async () => {
    const directory = await accountsDirectory();
    const filePath = join(directory, 'accounts.json');
    const changed: number[] = [];
    const watcher = new AccountsFileWatcher({
      filePath,
      onChanged: () => {
        changed.push(1);
      },
    });

    await watcher.prime();
    await watcher.refresh();
    expect(changed).toEqual([]);

    await writeAccounts(filePath, 'first');
    await watcher.refresh();

    expect(changed).toEqual([1]);
  });

  it('should surface a read failure that is not a missing file', async () => {
    const directory = await accountsDirectory();
    const watcher = new AccountsFileWatcher({ filePath: directory, onChanged: () => undefined });

    await expect(watcher.prime()).rejects.toThrow();
  });
});

// Helpers

async function accountsDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-accounts-watcher-reads-'));

  temporaryDirectories.push(directory);

  return directory;
}

async function writeAccounts(filePath: string, label: string): Promise<void> {
  const document = {
    schemaVersion: ACCOUNTS_VERSION,
    accounts: [
      {
        id: 'account-1',
        kind: 'api-key',
        provider: 'openai',
        label,
        credentialRef: 'vault-account-1',
      },
    ],
  };

  await writeFile(filePath, JSON.stringify(document), 'utf8');
}
