import { z } from 'zod';

import { migrateDocument, type Migration } from './migration';

export const ACCOUNTS_VERSION = 1;

const accountSchema = z.strictObject({
  id: z.string().min(1),
  provider: z.string().min(1),
  kind: z.enum(['subscription', 'api-key', 'aggregator']),
  label: z.string().trim().min(1),
  credentialRef: z.string().min(1),
});

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

const accountsMigrations: readonly Migration[] = [];

export function loadAccountsDocument(doc: unknown): AccountsDocument {
  return accountsDocumentSchema.parse(migrateDocument(doc, accountsMigrations, ACCOUNTS_VERSION));
}

export function defaultAccountsDocument(): AccountsDocument {
  return { schemaVersion: ACCOUNTS_VERSION, accounts: [] };
}
