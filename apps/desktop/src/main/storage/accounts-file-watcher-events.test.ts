import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccountsFileWatcher, type AccountsWatchEvents } from './accounts-file-watcher';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe('AccountsFileWatcher filtering directory events', () => {
  it('should change nothing when the event names another file in the directory', async () => {
    vi.useFakeTimers();
    const fixture = await accountsFixture();

    await fixture.watcher.start();
    await writeAccounts(fixture.filePath, 'second');
    fixture.events[0]?.change('settings.json');
    await vi.advanceTimersByTimeAsync(200);

    expect(fixture.changed).toEqual([]);
  });

  it('should change nothing when the event names a blank file', async () => {
    vi.useFakeTimers();
    const fixture = await accountsFixture();

    await fixture.watcher.start();
    await writeAccounts(fixture.filePath, 'second');
    fixture.events[0]?.change('   ');
    await vi.advanceTimersByTimeAsync(200);

    expect(fixture.changed).toEqual([]);
  });

  it('should read the accounts file again when the event names no file', async () => {
    vi.useFakeTimers();
    const fixture = await accountsFixture();

    await fixture.watcher.start();
    await writeAccounts(fixture.filePath, 'second');
    fixture.events[0]?.change(null);
    await vi.advanceTimersByTimeAsync(75);

    await vi.waitFor(() => {
      expect(fixture.changed).toEqual([1]);
    });
  });
});

describe('AccountsFileWatcher reporting failures', () => {
  it('should report a failure raised by the directory watch', async () => {
    const fixture = await accountsFixture();
    const failure = new Error('directory watch failure');

    await fixture.watcher.start();
    fixture.events[0]?.error(failure);

    expect(fixture.errors).toEqual([failure]);
  });

  it('should report accounts content it cannot read after the debounce', async () => {
    vi.useFakeTimers();
    const fixture = await accountsFixture();

    await fixture.watcher.start();
    await writeFile(fixture.filePath, '{ half a document', 'utf8');
    fixture.events[0]?.change('accounts.json');
    await vi.advanceTimersByTimeAsync(75);

    await vi.waitFor(() => {
      expect(fixture.errors).toHaveLength(1);
    });
  });
});

// Helpers

async function accountsFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-accounts-watcher-events-'));
  const filePath = join(directory, 'accounts.json');
  const changed: number[] = [];
  const errors: unknown[] = [];
  const events: AccountsWatchEvents[] = [];

  temporaryDirectories.push(directory);
  await writeAccounts(filePath, 'first');

  const watcher = new AccountsFileWatcher({
    filePath,
    onChanged: () => {
      changed.push(1);
    },
    onError: (failure) => {
      errors.push(failure);
    },
    watchDirectory: (_directory, installed) => {
      events.push(installed);

      return { close: () => undefined };
    },
  });

  return { changed, errors, events, filePath, watcher };
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
