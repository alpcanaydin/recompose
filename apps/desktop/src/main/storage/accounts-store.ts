import {
  defaultAccountsDocument,
  loadAccountsDocument,
  type AccountsDocument,
} from '@recompose/contracts';

import { readDocumentWithQuarantine, writeJsonAtomic } from './json-file';
import { oneAtATime } from './one-at-a-time';

const inAccountsOrder = oneAtATime();

export async function loadAccountsFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<AccountsDocument> {
  const accounts = await readDocumentWithQuarantine(filePath, loadAccountsDocument, onCorrupt);

  return accounts ?? defaultAccountsDocument();
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
