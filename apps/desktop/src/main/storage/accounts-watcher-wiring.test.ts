import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startAccountsWatcher } from './accounts-watcher-wiring';
import { accountsDocument, EVENT_DRIVEN_TIMEOUT, untilNoticed } from './watcher-wiring.testkit';

const temporaryDirectories: string[] = [];
const openWatchers: { close: () => void }[] = [];

afterEach(async () => {
  for (const watcher of openWatchers.splice(0)) watcher.close();

  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe('the accounts file as recompose watches it', () => {
  it(
    'reports the accounts changing under it',
    async () => {
      const stored = await watchedAccounts('personal');

      await untilNoticed(
        async () => writeFile(stored.accountsPath, accountsDocument('work'), 'utf8'),
        () => {
          expect(stored.notices).toEqual(['accounts changed']);
        },
      );
    },
    EVENT_DRIVEN_TIMEOUT,
  );
});

describe('accounts content recompose cannot read', () => {
  it(
    'is written down rather than swallowed',
    async () => {
      const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const stored = await watchedAccounts('personal');

      await untilNoticed(
        async () => writeFile(stored.accountsPath, 'not json at all', 'utf8'),
        () => {
          expect(complaint).toHaveBeenCalled();
        },
      );

      expect(complaint.mock.calls.flat().map(String).join(' ')).toContain('accounts');
      expect(stored.notices).toEqual([]);
    },
    EVENT_DRIVEN_TIMEOUT,
  );
});

// Helpers

async function watchedAccounts(label: string) {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-accounts-wiring-'));
  const accountsPath = join(userDataPath, 'accounts.json');
  const notices: string[] = [];

  temporaryDirectories.push(userDataPath);
  await writeFile(accountsPath, accountsDocument(label), 'utf8');

  const watcher = await startAccountsWatcher({
    userDataPath,
    onChanged: () => {
      notices.push('accounts changed');
    },
  });

  openWatchers.push(watcher);

  return { accountsPath, notices };
}
