import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';

import { AccountsFileWatcher } from './accounts-file-watcher';

const temporaryDirectories: string[] = [];
const openWatchers: AccountsFileWatcher[] = [];

afterEach(async () => {
  for (const watcher of openWatchers.splice(0)) watcher.close();

  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe('AccountsFileWatcher over the real accounts directory', () => {
  it('should report accounts rewritten on disk', async () => {
    const fixture = await accountsFixture();

    await fixture.watcher.start();
    await rewriteUntilReported(fixture);

    expect(fixture.changed).toHaveLength(1);
  });
});

// Helpers

type WatcherFixture = { changed: number[]; filePath: string; watcher: AccountsFileWatcher };

async function rewriteUntilReported(fixture: WatcherFixture): Promise<void> {
  for (let attempt = 0; attempt < 100 && fixture.changed.length === 0; attempt += 1) {
    await writeAccounts(fixture.filePath, 'second');
    await delay(50);
  }
}

async function accountsFixture(): Promise<WatcherFixture> {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-accounts-watcher-fs-'));
  const filePath = join(directory, 'accounts.json');
  const changed: number[] = [];

  temporaryDirectories.push(directory);
  await writeAccounts(filePath, 'first');

  const watcher = new AccountsFileWatcher({
    filePath,
    debounceMs: 10,
    onChanged: () => {
      changed.push(1);
    },
  });

  openWatchers.push(watcher);

  return { changed, filePath, watcher };
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
