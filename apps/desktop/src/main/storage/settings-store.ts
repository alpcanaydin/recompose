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

  try {
    return loadSettings(raw);
  } catch {
    await quarantineFile(filePath, onCorrupt);

    return defaultSettings();
  }
}

export async function saveSettingsFile(filePath: string, settings: Settings): Promise<void> {
  await writeJsonAtomic(filePath, settings);
}
