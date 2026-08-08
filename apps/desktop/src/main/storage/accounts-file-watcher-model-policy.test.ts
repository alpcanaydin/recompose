import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { describe, expect, it } from 'vitest';

import { AccountsFileWatcher } from './accounts-file-watcher';

describe('AccountsFileWatcher model policy semantics', () => {
  it('ignores normalized policy spelling and detects display-name changes and removals', async () => {
    const values = [
      accountsText(' Anthropic ', ['MODEL-B', ' model-a ', 'model-b'], 'First'),
      accountsText('anthropic', ['model-a', 'model-b'], 'First'),
      accountsText('ANTHROPIC', ['model-b', 'model-a'], 'Second'),
      accountsText(undefined, [], undefined),
    ];
    const changed: number[] = [];
    const watcher = new AccountsFileWatcher({
      filePath: '/tmp/recompose/accounts.json',
      onChanged: () => {
        changed.push(1);
      },
      read: async () => Promise.resolve(values.shift()),
    });

    await watcher.prime();
    await watcher.refresh();
    expect(changed).toEqual([]);

    await watcher.refresh();
    await watcher.refresh();
    expect(changed).toEqual([1, 1]);
  });
});

function accountsText(
  provider: string | undefined,
  excludedModels: readonly string[],
  displayName: string | undefined,
): string {
  const modelPolicies =
    provider === undefined
      ? {}
      : {
          [provider]: {
            excludedModels,
            aliases: [
              {
                name: 'model-a',
                alias: 'friendly-model',
                ...(displayName === undefined ? {} : { displayName }),
              },
            ],
          },
        };

  return JSON.stringify({ schemaVersion: ACCOUNTS_VERSION, accounts: [], modelPolicies });
}
