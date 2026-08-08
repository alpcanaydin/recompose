import { describe, expect, test } from 'vitest';

import { ACCOUNTS_VERSION, loadAccountsDocument } from './accounts';

describe('provider model policy storage', () => {
  test('provider keys and excluded models parse to one canonical spelling', () => {
    const parsed = loadAccountsDocument({
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [],
      modelPolicies: {
        ' Anthropic ': {
          excludedModels: [' Claude-Old ', 'claude-old', 'CLAUDE-OTHER'],
          aliases: [
            { name: ' Model-A ', alias: ' Alias-A ', displayName: ' Friendly ' },
            { name: 'model-a', alias: 'alias-a', displayName: 'Friendly' },
          ],
        },
      },
    });

    expect(parsed.modelPolicies).toEqual({
      anthropic: {
        excludedModels: ['claude-old', 'claude-other'],
        aliases: [{ name: 'model-a', alias: 'alias-a', displayName: 'Friendly' }],
      },
    });
  });

  test('a version four registry migrates without inventing policy', () => {
    expect(loadAccountsDocument({ schemaVersion: 4, accounts: [] })).toEqual({
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [],
    });
  });
});
