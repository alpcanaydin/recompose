import { z } from 'zod';

import { migrateDocument, type Migration } from './migration';
import { nonBlankString } from './non-blank';
import { subscriptionProviderIdSchema } from './subscriptions';

export const ACCOUNTS_VERSION = 2;

export const accountKindSchema = z.enum(['subscription', 'api-key', 'aggregator', 'local']);

export type AccountKind = z.infer<typeof accountKindSchema>;

export const credentialedAccountKindSchema = z.enum(['api-key', 'aggregator']);

export type CredentialedAccountKind = z.infer<typeof credentialedAccountKindSchema>;

const subscriptionAccountSchema = z.strictObject({
  id: nonBlankString,
  provider: subscriptionProviderIdSchema,
  kind: z.literal('subscription'),
  label: z.string().trim().min(1),
});

export type SubscriptionAccount = z.infer<typeof subscriptionAccountSchema>;

const credentialedAccountSchema = z.strictObject({
  id: nonBlankString,
  provider: nonBlankString,
  kind: credentialedAccountKindSchema,
  label: z.string().trim().min(1),
  credentialRef: nonBlankString,
});

export type CredentialedAccount = z.infer<typeof credentialedAccountSchema>;

const accountSchema = z.discriminatedUnion('kind', [
  subscriptionAccountSchema,
  credentialedAccountSchema,
]);

export type Account = z.infer<typeof accountSchema>;

export const accountsDocumentSchema = z
  .strictObject({
    schemaVersion: z.literal(ACCOUNTS_VERSION),
    accounts: z.array(accountSchema),
  })
  .refine(
    (doc) => new Set(doc.accounts.map((account) => account.id)).size === doc.accounts.length,
    { message: 'duplicate account id' },
  );

export type AccountsDocument = z.infer<typeof accountsDocumentSchema>;

const versionOneAccounts = z.array(z.looseObject({ kind: z.string() }));

type VersionOneAccount = z.infer<typeof versionOneAccounts>[number];

function pastedSecretReadsAsAKey(row: VersionOneAccount): VersionOneAccount {
  return row.kind === 'subscription' ? { ...row, kind: 'api-key' } : row;
}

const subscriptionRowsHeldPastedSecrets: Migration = {
  from: 1,
  migrate: (doc) => {
    const stored = versionOneAccounts.safeParse(doc['accounts']);

    return {
      ...doc,
      schemaVersion: 2,
      accounts: stored.success ? stored.data.map(pastedSecretReadsAsAKey) : doc['accounts'],
    };
  },
};

const accountsMigrations: readonly Migration[] = [subscriptionRowsHeldPastedSecrets];

export function loadAccountsDocument(doc: unknown): AccountsDocument {
  return accountsDocumentSchema.parse(migrateDocument(doc, accountsMigrations, ACCOUNTS_VERSION));
}

export function defaultAccountsDocument(): AccountsDocument {
  return { schemaVersion: ACCOUNTS_VERSION, accounts: [] };
}
