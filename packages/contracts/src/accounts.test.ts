import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import {
  ACCOUNTS_VERSION,
  accountKindSchema,
  credentialedAccountKindSchema,
  defaultAccountsDocument,
  loadAccountsDocument,
  type Account,
} from './accounts';

const subscriptionRow = {
  id: 'acc-claude-max',
  provider: 'anthropic',
  kind: 'subscription',
  label: 'Claude Max',
};

const keyRow = {
  id: 'acc-work-key',
  provider: 'anthropic',
  kind: 'api-key',
  label: 'Work',
  credentialRef: 'cred-7f3a',
};

const aggregatorRow = {
  id: 'acc-router',
  provider: 'openrouter',
  kind: 'aggregator',
  label: 'Router',
  credentialRef: 'cred-91bd',
};

function vaultReferenceOf(account: Account): string | undefined {
  return account.kind === 'subscription' ? undefined : account.credentialRef;
}

describe('the row the accounts registry stores', () => {
  test('a subscription row parses carrying identity alone', () => {
    const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [subscriptionRow] };

    expect(loadAccountsDocument(stored)).toEqual(stored);
  });

  test('a credentialed row parses carrying the reference the vault answers to', () => {
    const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [keyRow, aggregatorRow] };

    expect(loadAccountsDocument(stored)).toEqual(stored);
  });

  test('a subscription row referencing the vault is refused', () => {
    const stored = {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [{ ...subscriptionRow, credentialRef: 'cred-7f3a' }],
    };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });

  test('a credentialed row without its reference is refused', () => {
    const { credentialRef, ...withoutTheReference } = keyRow;
    const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [withoutTheReference] };

    expect(credentialRef).toBe('cred-7f3a');
    expect(() => loadAccountsDocument(stored)).toThrow();
  });

  test('a subscription row naming a provider no tool signs in is refused', () => {
    const stored = {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [{ ...subscriptionRow, provider: 'openrouter' }],
    };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });

  test('a stored local row is refused, because no local provider connects yet', () => {
    const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [{ ...keyRow, kind: 'local' }] };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });

  test('the kind vocabulary names four kinds, and only two of them carry a credential', () => {
    expect(accountKindSchema.options).toEqual(['subscription', 'api-key', 'aggregator', 'local']);
    expect(credentialedAccountKindSchema.options).toEqual(['api-key', 'aggregator']);
  });

  test('a kind outside the vocabulary is refused', () => {
    const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [{ ...keyRow, kind: 'oauth' }] };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });
});

describe('what the accounts registry refuses to hold', () => {
  test('the default registry is empty and current-version', () => {
    expect(defaultAccountsDocument()).toEqual({ schemaVersion: 2, accounts: [] });
  });

  test('an account never carries a raw secret field', () => {
    const stored = {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [{ ...subscriptionRow, apiKey: 'sk-oops' }],
    };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });

  test('duplicate account ids are rejected', () => {
    const stored = {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [subscriptionRow, subscriptionRow],
    };

    expect(() => loadAccountsDocument(stored)).toThrow(/duplicate/i);
  });

  test('a whitespace-only account id is rejected', () => {
    const stored = {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [{ ...subscriptionRow, id: '  ' }],
    };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });

  test('a whitespace-only credential reference is rejected', () => {
    const stored = {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [{ ...keyRow, credentialRef: '   ' }],
    };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });

  test('a whitespace-only label is rejected on either arm of the row', () => {
    for (const row of [subscriptionRow, keyRow]) {
      const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [{ ...row, label: '   ' }] };

      expect(() => loadAccountsDocument(stored)).toThrow();
    }
  });
});

describe('a stored version 1 document, written while a subscription held a pasted secret', () => {
  test('the subscription row becomes a key row, keeping its id, label, and credential', () => {
    const storedUnderVersionOne = {
      schemaVersion: 1,
      accounts: [{ ...subscriptionRow, credentialRef: 'cred-7f3a' }],
    };

    expect(loadAccountsDocument(storedUnderVersionOne)).toEqual({
      schemaVersion: 2,
      accounts: [{ ...subscriptionRow, kind: 'api-key', credentialRef: 'cred-7f3a' }],
    });
  });

  test('a key row travels untouched', () => {
    expect(loadAccountsDocument({ schemaVersion: 1, accounts: [keyRow] })).toEqual({
      schemaVersion: 2,
      accounts: [keyRow],
    });
  });

  test('an aggregator row travels untouched', () => {
    expect(loadAccountsDocument({ schemaVersion: 1, accounts: [aggregatorRow] })).toEqual({
      schemaVersion: 2,
      accounts: [aggregatorRow],
    });
  });

  test('an empty registry crosses the version with nothing invented', () => {
    expect(loadAccountsDocument({ schemaVersion: 1, accounts: [] })).toEqual({
      schemaVersion: 2,
      accounts: [],
    });
  });

  test('a document whose accounts are not a list is refused naming what it actually held', () => {
    expect(() => loadAccountsDocument({ schemaVersion: 1, accounts: 'none' })).toThrow(
      /received string/,
    );
  });
});

describe('every version 1 document a machine could hold', () => {
  const nonBlank = fc.string({ minLength: 1, maxLength: 12 }).map((value) => `x${value.trim()}`);

  const versionOneRows = fc.record({
    id: nonBlank,
    provider: nonBlank,
    kind: fc.constantFrom('subscription', 'api-key', 'aggregator'),
    label: nonBlank,
    credentialRef: nonBlank,
  });

  const versionOneDocuments = fc.record({
    schemaVersion: fc.constant(1),
    accounts: fc.uniqueArray(versionOneRows, { selector: (row) => row.id, maxLength: 6 }),
  });

  test.prop([versionOneDocuments])(
    'it reaches version 2 with its identifiers intact and no subscription row referencing the vault',
    (storedUnderVersionOne) => {
      const migrated = loadAccountsDocument(storedUnderVersionOne);
      const stored = storedUnderVersionOne.accounts;

      expect(migrated.schemaVersion).toBe(2);
      expect(migrated.accounts.map((account) => account.id)).toEqual(stored.map((row) => row.id));
      expect(migrated.accounts.map((account) => account.label)).toEqual(
        stored.map((row) => row.label),
      );
      expect(migrated.accounts.map(vaultReferenceOf)).toEqual(
        stored.map((row) => row.credentialRef),
      );
      expect(migrated.accounts.filter((account) => account.kind === 'subscription')).toEqual([]);
    },
  );
});
