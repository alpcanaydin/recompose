import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { loadAccountsDocument, type Account } from './accounts';

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

const nonBlank = fc.string({ minLength: 1, maxLength: 12 }).map((value) => `x${value.trim()}`);

function vaultReferenceOf(account: Account): string | undefined {
  return account.kind === 'subscription' ? undefined : account.credentialRef;
}

describe('a stored version 1 document, written while a subscription held a pasted secret', () => {
  test('the subscription row becomes a key row, keeping its id, label, and credential', () => {
    const storedUnderVersionOne = {
      schemaVersion: 1,
      accounts: [{ ...subscriptionRow, credentialRef: 'cred-7f3a' }],
    };

    expect(loadAccountsDocument(storedUnderVersionOne)).toEqual({
      schemaVersion: 3,
      accounts: [{ ...subscriptionRow, kind: 'api-key', credentialRef: 'cred-7f3a' }],
    });
  });

  test('a key row travels untouched', () => {
    expect(loadAccountsDocument({ schemaVersion: 1, accounts: [keyRow] })).toEqual({
      schemaVersion: 3,
      accounts: [keyRow],
    });
  });

  test('an aggregator row travels untouched', () => {
    expect(loadAccountsDocument({ schemaVersion: 1, accounts: [aggregatorRow] })).toEqual({
      schemaVersion: 3,
      accounts: [aggregatorRow],
    });
  });

  test('an empty registry crosses the version with nothing invented', () => {
    expect(loadAccountsDocument({ schemaVersion: 1, accounts: [] })).toEqual({
      schemaVersion: 3,
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
    'it reaches the current version with its identifiers intact and no subscription row referencing the vault',
    (storedUnderVersionOne) => {
      const migrated = loadAccountsDocument(storedUnderVersionOne);
      const stored = storedUnderVersionOne.accounts;

      expect(migrated.schemaVersion).toBe(3);
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

describe('a stored version 2 document, written before a row published a mask', () => {
  test('the document restamps to version 3 and hands back the rows it held', () => {
    const storedUnderVersionTwo = {
      schemaVersion: 2,
      accounts: [subscriptionRow, keyRow, aggregatorRow],
    };

    expect(loadAccountsDocument(storedUnderVersionTwo)).toEqual({
      schemaVersion: 3,
      accounts: [subscriptionRow, keyRow, aggregatorRow],
    });
  });

  test('an empty registry crosses the version with nothing invented', () => {
    expect(loadAccountsDocument({ schemaVersion: 2, accounts: [] })).toEqual({
      schemaVersion: 3,
      accounts: [],
    });
  });

  test('no row gains a mask on the way, because contracts can never read the vault', () => {
    const migrated = loadAccountsDocument({ schemaVersion: 2, accounts: [keyRow] });

    expect(migrated.accounts[0]).not.toHaveProperty('keyTail');
  });
});

describe('every version 2 document a machine could hold', () => {
  const versionTwoRows = fc.oneof(
    fc.record({
      id: nonBlank,
      provider: fc.constantFrom('anthropic', 'openai'),
      kind: fc.constant('subscription'),
      label: nonBlank,
    }),
    fc.record({
      id: nonBlank,
      provider: nonBlank,
      kind: fc.constantFrom('api-key', 'aggregator'),
      label: nonBlank,
      credentialRef: nonBlank,
    }),
  );

  const versionTwoDocuments = fc.record({
    schemaVersion: fc.constant(2),
    accounts: fc.uniqueArray(versionTwoRows, { selector: (row) => row.id, maxLength: 6 }),
  });

  test.prop([versionTwoDocuments])(
    'it reaches version 3 with every row byte-identical to the one stored',
    (storedUnderVersionTwo) => {
      const migrated = loadAccountsDocument(storedUnderVersionTwo);

      expect(migrated.schemaVersion).toBe(3);
      expect(JSON.stringify(migrated.accounts)).toBe(
        JSON.stringify(storedUnderVersionTwo.accounts),
      );
    },
  );
});
