import { describe, expectTypeOf, test } from 'vitest';

import type {
  Account,
  AccountKind,
  AccountsDocument,
  CredentialedAccount,
  CredentialedAccountKind,
  IpcRequest,
  SubscriptionAccount,
  SubscriptionProviderId,
} from './index';

import { defaultAccountsDocument, loadAccountsDocument } from './accounts';

describe('the account row the document stores', () => {
  test('the document pins itself to schema version 3', () => {
    expectTypeOf<AccountsDocument['schemaVersion']>().toEqualTypeOf<3>();
  });

  test('a stored row is either a subscription or a credentialed account', () => {
    expectTypeOf<AccountsDocument['accounts'][number]>().toEqualTypeOf<Account>();
    expectTypeOf<Account['kind']>().toEqualTypeOf<'subscription' | 'api-key' | 'aggregator'>();
  });

  test('a subscription row structurally cannot reference the vault', () => {
    expectTypeOf<SubscriptionAccount>().not.toHaveProperty('credentialRef');
    expectTypeOf<Extract<Account, { kind: 'subscription' }>>().not.toHaveProperty('credentialRef');
    expectTypeOf<keyof SubscriptionAccount>().toEqualTypeOf<'id' | 'provider' | 'kind' | 'label'>();
  });

  test('a subscription row names a provider whose own tool signs it in', () => {
    expectTypeOf<SubscriptionAccount['provider']>().toEqualTypeOf<SubscriptionProviderId>();
  });

  test('a credentialed row carries the reference the vault answers to', () => {
    expectTypeOf<
      Extract<Account, { kind: CredentialedAccountKind }>
    >().toEqualTypeOf<CredentialedAccount>();
    expectTypeOf<CredentialedAccount['credentialRef']>().toEqualTypeOf<string>();
    expectTypeOf<CredentialedAccount['kind']>().toEqualTypeOf<'api-key' | 'aggregator'>();
  });

  test('the mask is optional, so a row stored before it existed still types', () => {
    expectTypeOf<CredentialedAccount['keyTail']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<{
      id: string;
      provider: string;
      kind: CredentialedAccountKind;
      label: string;
      credentialRef: string;
    }>().toExtend<CredentialedAccount>();
  });

  test('no arm of a stored row has a field the key itself could occupy', () => {
    expectTypeOf<Account>().not.toHaveProperty('secret');
    expectTypeOf<Account>().not.toHaveProperty('key');
    expectTypeOf<CredentialedAccount>().not.toHaveProperty('secret');
    expectTypeOf<CredentialedAccount>().not.toHaveProperty('key');
    expectTypeOf<SubscriptionAccount>().not.toHaveProperty('secret');
    expectTypeOf<SubscriptionAccount>().not.toHaveProperty('key');
  });

  test('the vocabulary knows the local kind, though no stored row can name it', () => {
    expectTypeOf<AccountKind>().toEqualTypeOf<
      'subscription' | 'api-key' | 'aggregator' | 'local'
    >();
    expectTypeOf<CredentialedAccountKind>().toEqualTypeOf<'api-key' | 'aggregator'>();
    expectTypeOf<Extract<Account, { kind: 'local' }>>().toEqualTypeOf<never>();
  });
});

describe('the channel that connects an account', () => {
  test('connecting cannot name a subscription, because no secret exists to carry', () => {
    expectTypeOf<IpcRequest<'accounts:connect'>['kind']>().toEqualTypeOf<CredentialedAccountKind>();
    expectTypeOf<
      Extract<IpcRequest<'accounts:connect'>['kind'], 'subscription' | 'local'>
    >().toEqualTypeOf<never>();
  });
});

describe('the migration a stored document travels', () => {
  test('loading answers the current document shape, never the stored one', () => {
    expectTypeOf(loadAccountsDocument).toEqualTypeOf<(doc: unknown) => AccountsDocument>();
    expectTypeOf(defaultAccountsDocument).toEqualTypeOf<() => AccountsDocument>();
  });

  test('what a migration answers is the raw shape, so no stored row is typed before it parses', () => {
    expectTypeOf<ReturnType<typeof loadAccountsDocument>['accounts']>().toEqualTypeOf<Account[]>();
  });
});
