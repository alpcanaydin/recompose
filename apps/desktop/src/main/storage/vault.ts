import type { SecretCodec } from './safe-storage-codec';

import { quarantineFile, readJsonWithQuarantine, writeJsonAtomic } from './json-file';

export type VaultDocument = {
  schemaVersion: 1;
  entries: Record<string, string>;
};

const emptyVault: VaultDocument = { schemaVersion: 1, entries: {} };

export class VaultNewerSchemaError extends Error {
  constructor(schemaVersion: number) {
    super(`vault schemaVersion ${schemaVersion} is newer than supported 1`);
    this.name = 'VaultNewerSchemaError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVaultDocument(value: unknown): value is VaultDocument {
  if (!isRecord(value)) {
    return false;
  }

  const { schemaVersion, entries } = value;

  if (schemaVersion !== 1 || !isRecord(entries)) {
    return false;
  }

  return Object.values(entries).every((entry) => typeof entry === 'string');
}

function readNewerSchemaVersion(value: unknown): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { schemaVersion } = value;

  return typeof schemaVersion === 'number' && Number.isInteger(schemaVersion) && schemaVersion > 1
    ? schemaVersion
    : undefined;
}

export async function loadVaultFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<VaultDocument> {
  const raw = await readJsonWithQuarantine(filePath, onCorrupt);

  if (raw === undefined) {
    return emptyVault;
  }

  if (isVaultDocument(raw)) {
    return raw;
  }

  const newerVersion = readNewerSchemaVersion(raw);

  if (newerVersion !== undefined) {
    throw new VaultNewerSchemaError(newerVersion);
  }

  await quarantineFile(filePath, onCorrupt);

  return emptyVault;
}

export async function saveVaultFile(filePath: string, vault: VaultDocument): Promise<void> {
  await writeJsonAtomic(filePath, vault);
}

export function setSecret(
  vault: VaultDocument,
  codec: SecretCodec,
  ref: string,
  plain: string,
): VaultDocument {
  return { ...vault, entries: { ...vault.entries, [ref]: codec.encrypt(plain) } };
}

export function getSecret(
  vault: VaultDocument,
  codec: SecretCodec,
  ref: string,
): string | undefined {
  const encrypted = vault.entries[ref];

  if (encrypted === undefined) {
    return undefined;
  }

  return codec.decrypt(encrypted);
}

export function deleteSecret(vault: VaultDocument, ref: string): VaultDocument {
  const rest = Object.fromEntries(
    Object.entries(vault.entries).filter(([entryRef]) => entryRef !== ref),
  );

  return { ...vault, entries: rest };
}
