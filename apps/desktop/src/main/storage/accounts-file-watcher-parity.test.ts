import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AccountsFileWatcher,
  type AccountsWatchEvents,
  normalizedAccountsEventPath,
} from './accounts-file-watcher';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { recursive: true });
    }),
  );
});

describe('accounts/auth watcher subscriber parity', () => {
  it('TestAuthFileClientChangesNotifyUsageSubscribersToRefresh', async () => {
    const fixture = await fixtureWithAccounts('first');

    await fixture.watcher.prime();
    await writeAccounts(fixture.filePath, 'second');
    await fixture.watcher.refresh();

    expect(fixture.changed).toHaveLength(1);
  });

  it('TestHandleEventAuthWriteTriggersUpdate', async () => {
    vi.useFakeTimers();
    const fixture = await fixtureWithAccounts('first');

    await fixture.watcher.start();
    await writeAccounts(fixture.filePath, 'second');
    fixture.events.change('accounts.json');
    await vi.advanceTimersByTimeAsync(75);
    await vi.waitFor(() => {
      expect(fixture.changed).toHaveLength(1);
    });

    expect(fixture.changed).toHaveLength(1);
    fixture.watcher.close();
  });
});

describe('accounts/auth unchanged and normalized-path parity', () => {
  it('TestAuthFileUnchangedEmptyAndMissing', async () => {
    const values = [accountsText('first'), '', undefined];
    const changed: number[] = [];
    const watcher = new AccountsFileWatcher({
      filePath: '/tmp/recompose/accounts.json',
      onChanged: () => {
        changed.push(1);
      },
      read: async () => {
        await Promise.resolve();

        return values.shift();
      },
    });

    await watcher.prime();
    await watcher.refresh();
    await watcher.refresh();

    expect(changed).toEqual([]);
  });

  it('TestNormalizeAuthPathAndDebounceCleanup', async () => {
    vi.useFakeTimers();
    const fixture = await fixtureWithAccounts('first');

    expect(normalizedAccountsEventPath(fixture.filePath, './accounts.json')).toBe(fixture.filePath);
    expect(normalizedAccountsEventPath(fixture.filePath, fixture.filePath)).toBe(fixture.filePath);
    expect(normalizedAccountsEventPath(fixture.filePath, '../other/accounts.json')).toBeUndefined();

    await fixture.watcher.start();
    await writeAccounts(fixture.filePath, 'second');
    fixture.events.change('./accounts.json');
    fixture.events.change(fixture.filePath);
    fixture.watcher.close();
    await vi.advanceTimersByTimeAsync(75);

    expect(fixture.changed).toEqual([]);
  });
});

// Helpers

async function fixtureWithAccounts(label: string) {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-accounts-watcher-'));
  const filePath = join(directory, 'accounts.json');
  const changed: number[] = [];
  let events: AccountsWatchEvents = {
    change: () => undefined,
    error: () => undefined,
  };

  temporaryDirectories.push(directory);
  await writeAccounts(filePath, label);

  const watcher = new AccountsFileWatcher({
    filePath,
    onChanged: () => {
      changed.push(1);
    },
    watchDirectory: (_directory, installed) => {
      events.change = installed.change;
      events.error = installed.error;

      return { close: () => undefined };
    },
  });

  return { changed, events, filePath, watcher };
}

async function writeAccounts(filePath: string, label: string): Promise<void> {
  await writeFile(filePath, accountsText(label), 'utf8');
}

function accountsText(label: string): string {
  return JSON.stringify({
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
  });
}
