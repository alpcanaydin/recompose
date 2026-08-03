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

const localRow = {
  id: 'acc-ollama',
  provider: 'ollama',
  kind: 'local',
  address: 'http://127.0.0.1:11434',
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

  test('the kind vocabulary names four kinds, and only two of them carry a credential', () => {
    expect(accountKindSchema.options).toEqual(['subscription', 'api-key', 'aggregator', 'local']);
    expect(credentialedAccountKindSchema.options).toEqual(['api-key', 'aggregator']);
  });

  test('a kind outside the vocabulary is refused', () => {
    const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [{ ...keyRow, kind: 'oauth' }] };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });
});

describe('the local row a runtime stands as', () => {
  test('a local row parses carrying the runtime and the address it answers at', () => {
    const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [localRow] };

    expect(loadAccountsDocument(stored)).toEqual(stored);
  });

  test('a local row referencing the vault is refused, because nothing exists to reference', () => {
    const stored = {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [{ ...localRow, credentialRef: 'cred-7f3a' }],
    };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });

  test('a local row carrying a label is refused, because the runtime name is the row name', () => {
    const stored = {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [{ ...localRow, label: 'My Ollama' }],
    };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });

  test('a local row carrying a secret of any name is refused', () => {
    for (const smuggled of [{ secret: 'sk-oops' }, { apiKey: 'sk-oops' }, { keyTail: '9f2c' }]) {
      const stored = {
        schemaVersion: ACCOUNTS_VERSION,
        accounts: [{ ...localRow, ...smuggled }],
      };

      expect(() => loadAccountsDocument(stored)).toThrow();
    }
  });

  test('a local row naming a runtime nothing reaches is refused', () => {
    const stored = {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [{ ...localRow, provider: 'vllm' }],
    };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });
});

describe('the address a local row is allowed to hold', () => {
  test('a row at localhost is refused, so no stored row can name the wrong family', () => {
    const stored = {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [{ ...localRow, address: 'http://localhost:11434' }],
    };

    expect(() => loadAccountsDocument(stored)).toThrow();
  });

  test('a row aimed off this machine is refused', () => {
    for (const address of ['http://example.com:11434', 'http://169.254.169.254:11434']) {
      const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [{ ...localRow, address }] };

      expect(() => loadAccountsDocument(stored)).toThrow();
    }
  });

  test('a row with no address at all is refused, because there would be nothing to look at', () => {
    const { address, ...withoutTheAddress } = localRow;
    const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [withoutTheAddress] };

    expect(address).toBe('http://127.0.0.1:11434');
    expect(() => loadAccountsDocument(stored)).toThrow();
  });

  test('a key row relabelled local is refused, because the local arm carries neither', () => {
    const stored = { schemaVersion: ACCOUNTS_VERSION, accounts: [{ ...keyRow, kind: 'local' }] };

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
    expect(defaultAccountsDocument()).toEqual({ schemaVersion: 4, accounts: [] });
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
