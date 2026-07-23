import { defaultAccountsDocument, type AccountsDocument } from '@recompose/contracts';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { loadAccountsFile, saveAccountsFile } from './accounts-store';

describe('accounts store', () => {
  test('absent file yields the empty registry', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-accounts-')), 'accounts.json');

    expect(await loadAccountsFile(file, () => undefined)).toEqual(defaultAccountsDocument());
  });

  test('a saved registry loads back identically', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-accounts-')), 'accounts.json');
    const doc: AccountsDocument = {
      schemaVersion: 1,
      accounts: [
        {
          id: 'a1',
          provider: 'anthropic',
          kind: 'subscription' as const,
          label: 'Max',
          credentialRef: 'c1',
        },
      ],
    };

    await saveAccountsFile(file, doc);

    expect(await loadAccountsFile(file, () => undefined)).toEqual(doc);
  });
});
