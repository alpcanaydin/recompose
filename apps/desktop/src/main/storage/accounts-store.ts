import {
  defaultAccountsDocument,
  loadAccountsDocument,
  type AccountsDocument,
} from '@recompose/contracts';

import { readDocumentWithQuarantine, writeJsonAtomic } from './json-file';

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
