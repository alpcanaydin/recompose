import { join } from 'node:path';

import { AccountsFileWatcher } from './accounts-file-watcher';

type AccountsWatcherWiring = {
  userDataPath: string;
  onChanged: () => void;
};

export async function startAccountsWatcher(
  wiring: AccountsWatcherWiring,
): Promise<AccountsFileWatcher> {
  const watcher = new AccountsFileWatcher({
    filePath: join(wiring.userDataPath, 'accounts.json'),
    onChanged: wiring.onChanged,
    onError: (failure) => {
      console.error('recompose could not refresh accounts after a storage change', failure);
    },
  });

  await watcher.start();

  return watcher;
}
