import {
  defaultSettings,
  loadSettings,
  SETTINGS_VERSION,
  type Settings,
} from '@recompose/contracts';

import {
  newerSchemaVersion,
  quarantineFile,
  readJsonWithQuarantine,
  writeJsonAtomic,
} from './json-file';

/**
 * A settings document this build is too old to read.
 *
 * @summary Thrown instead of quarantining, so a person who ran a newer build and came back keeps
 * every setting rather than being told their file was damaged.
 */
export class SettingsNewerSchemaError extends Error {
  readonly schemaVersion: number;

  constructor(schemaVersion: number) {
    super(
      `the settings document names schema version ${String(schemaVersion)}, and this build reads up to ${String(SETTINGS_VERSION)}`,
    );
    this.name = 'SettingsNewerSchemaError';
    this.schemaVersion = schemaVersion;
  }
}

export async function loadSettingsFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<Settings> {
  const raw = await readJsonWithQuarantine(filePath, onCorrupt);

  if (raw === undefined) {
    return defaultSettings();
  }

  const newer = newerSchemaVersion(raw, SETTINGS_VERSION);

  if (newer !== undefined) {
    throw new SettingsNewerSchemaError(newer);
  }

  let loaded: Settings;

  try {
    loaded = loadSettings(raw);
  } catch {
    await quarantineFile(filePath, onCorrupt);

    return defaultSettings();
  }

  return settledOnDisk(filePath, raw, loaded);
}

/**
 * Writes a document back when loading it changed its shape.
 *
 * @summary A migration that stays in memory leaves the retired fields on disk until the next
 * save, so the file claims one version while carrying another version's fields. That is the shape
 * that made a mid-development document unreadable: strict parsing refused the extra field, and the
 * migration never ran because the version already matched.
 *
 * A disk that refuses the write leaves the document exactly as it was, which is where it stood
 * before this step existed. The person keeps every setting, so the refusal is written down rather
 * than carried out to the caller as damage.
 */
async function settledOnDisk(filePath: string, raw: unknown, loaded: Settings): Promise<Settings> {
  if (JSON.stringify(raw) === JSON.stringify(loaded)) {
    return loaded;
  }

  try {
    await writeJsonAtomic(filePath, loaded);
  } catch (refusal: unknown) {
    console.error(
      `recompose carried the settings document at ${filePath} forward but could not write it back, so its retired fields stay on disk until the next save.`,
      refusal,
    );
  }

  return loaded;
}

export async function saveSettingsFile(filePath: string, settings: Settings): Promise<void> {
  await writeJsonAtomic(filePath, settings);
}
