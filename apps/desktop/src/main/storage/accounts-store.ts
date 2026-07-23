import {
  defaultAccountsDocument,
  loadAccountsDocument,
  type AccountsDocument,
} from '@recompose/contracts';

import { readJsonWithQuarantine, writeJsonAtomic } from './json-file';

export async function loadAccountsFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<AccountsDocument> {
  const raw = await readJsonWithQuarantine(filePath, onCorrupt);

  if (raw === undefined) {
    return defaultAccountsDocument();
  }

  return loadAccountsDocument(raw);
}

export async function saveAccountsFile(
  filePath: string,
  accounts: AccountsDocument,
): Promise<void> {
  await writeJsonAtomic(filePath, accounts);
}
