import { defaultAccountsDocument, type AccountsDocument } from '@recompose/contracts';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
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

  test('schema-invalid accounts are quarantined and the empty registry is returned', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'recompose-accounts-'));
    const file = join(dir, 'accounts.json');
    const invalid = {
      schemaVersion: 1,
      accounts: [
        {
          id: 'a1',
          provider: 'anthropic',
          kind: 'oauth',
          label: 'Max',
          credentialRef: 'c1',
        },
      ],
    };

    await writeFile(file, JSON.stringify(invalid), 'utf8');
    const seen: string[] = [];

    const accounts = await loadAccountsFile(file, (p) => {
      seen.push(p);
    });

    expect(accounts).toEqual(defaultAccountsDocument());
    expect(seen).toHaveLength(1);
    const entries = await readdir(dir);

    expect(entries).toEqual([expect.stringMatching(/^accounts\.json\.corrupt-/)]);
  });
});
