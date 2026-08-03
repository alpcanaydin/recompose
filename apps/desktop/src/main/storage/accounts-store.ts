import {
  ACCOUNTS_VERSION,
  defaultAccountsDocument,
  loadAccountsDocument,
  type AccountsDocument,
} from '@recompose/contracts';

import {
  newerSchemaVersion,
  quarantineFile,
  readJsonWithQuarantine,
  writeJsonAtomic,
} from './json-file';
import { oneAtATime } from './one-at-a-time';

const inAccountsOrder = oneAtATime();

/**
 * An accounts document this build is too old to read.
 *
 * @summary Thrown instead of quarantining, so a person who ran a newer build and came back keeps
 * every subscription and key row rather than finding an empty list and orphaned vault secrets.
 */
export class AccountsNewerSchemaError extends Error {
  readonly schemaVersion: number;

  constructor(schemaVersion: number) {
    super(
      `the accounts document names schema version ${String(schemaVersion)}, and this build reads up to ${String(ACCOUNTS_VERSION)}`,
    );
    this.name = 'AccountsNewerSchemaError';
    this.schemaVersion = schemaVersion;
  }
}

export async function loadAccountsFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<AccountsDocument> {
  const raw = await readJsonWithQuarantine(filePath, onCorrupt);

  if (raw === undefined) {
    return defaultAccountsDocument();
  }

  const newer = newerSchemaVersion(raw, ACCOUNTS_VERSION);

  if (newer !== undefined) {
    throw new AccountsNewerSchemaError(newer);
  }

  try {
    return loadAccountsDocument(raw);
  } catch {
    await quarantineFile(filePath, onCorrupt);

    return defaultAccountsDocument();
  }
}

export async function saveAccountsFile(
  filePath: string,
  accounts: AccountsDocument,
): Promise<void> {
  await writeJsonAtomic(filePath, accounts);
}

/**
 * Applies one change to the accounts document against its freshest state.
 *
 * @summary Every writer of accounts.json amends through here, because two writers that read
 * first and write later erase each other's rows. The lane holds only the read and the write, so
 * an act that waits minutes on a person never blocks the queue by amending late.
 */
export async function amendAccountsFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
  amend: (accounts: AccountsDocument) => AccountsDocument,
): Promise<AccountsDocument> {
  return inAccountsOrder(async () => {
    const amended = amend(await loadAccountsFile(filePath, onCorrupt));

    await saveAccountsFile(filePath, amended);

    return amended;
  });
}
