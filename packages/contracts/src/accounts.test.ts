import { describe, expect, test } from 'vitest';

import { defaultAccountsDocument, loadAccountsDocument } from './accounts';

const validDoc = {
  schemaVersion: 1,
  accounts: [
    {
      id: 'acc-claude-max',
      provider: 'anthropic',
      kind: 'subscription',
      label: 'Claude Max',
      credentialRef: 'cred-7f3a',
    },
  ],
};

describe('accounts registry', () => {
  test('a canonical registry parses and keeps its shape', () => {
    expect(loadAccountsDocument(validDoc)).toEqual(validDoc);
  });

  test('the default registry is empty and current-version', () => {
    expect(defaultAccountsDocument()).toEqual({ schemaVersion: 1, accounts: [] });
  });

  test('an account never carries a raw secret field', () => {
    const smuggled = {
      ...validDoc,
      accounts: [{ ...validDoc.accounts[0], apiKey: 'sk-oops' }],
    };

    expect(() => loadAccountsDocument(smuggled)).toThrow();
  });

  test('account kinds are the three provider surfaces', () => {
    for (const kind of ['subscription', 'api-key', 'aggregator']) {
      const doc = { ...validDoc, accounts: [{ ...validDoc.accounts[0], kind }] };

      expect(() => loadAccountsDocument(doc)).not.toThrow();
    }

    const invalid = { ...validDoc, accounts: [{ ...validDoc.accounts[0], kind: 'oauth' }] };

    expect(() => loadAccountsDocument(invalid)).toThrow();
  });

  test('duplicate account ids are rejected', () => {
    const doubled = { ...validDoc, accounts: [validDoc.accounts[0], validDoc.accounts[0]] };

    expect(() => loadAccountsDocument(doubled)).toThrow(/duplicate/i);
  });
});
