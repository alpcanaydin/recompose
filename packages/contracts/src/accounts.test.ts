import { describe, expect, test } from 'vitest';

import {
  ACCOUNTS_VERSION,
  accountKindSchema,
  credentialedAccountKindSchema,
  defaultAccountsDocument,
  loadAccountsDocument,
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

describe('the mask a key row publishes in place of its secret', () => {
  test('a key row carries the four characters that match it to a console entry', () => {
    const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [{ ...keyRow, keyTail: '9f2c' }] };

    expect(loadAccountsDocument(stored)).toEqual(stored);
  });

  test('a row stored before the mask existed parses carrying no tail at all', () => {
    const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [keyRow] };

    expect(loadAccountsDocument(stored)).toEqual(stored);
  });

  test('a tail of any width but four is refused, because the mask reveals a fixed window', () => {
    for (const tail of ['', '9f2', '9f2ca']) {
      const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [{ ...keyRow, keyTail: tail }] };

      expect(() => loadAccountsDocument(stored)).toThrow();
    }
  });

  test('a subscription row carries no tail, because no pasted key stands behind it', () => {
    const stored = {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [{ ...subscriptionRow, keyTail: '9f2c' }],
    };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });
});

describe('what the accounts registry refuses to hold', () => {
  test('the default registry is empty and current-version', () => {
    expect(defaultAccountsDocument()).toEqual({ schemaVersion: 3, accounts: [] });
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
