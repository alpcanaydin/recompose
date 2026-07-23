import { defaultSettings, loadSettings, type Settings } from '@recompose/contracts';

import { readJsonWithQuarantine, writeJsonAtomic } from './json-file';

export async function loadSettingsFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<Settings> {
  const raw = await readJsonWithQuarantine(filePath, onCorrupt);

  if (raw === undefined) {
    return defaultSettings();
  }

  return loadSettings(raw);
}

export async function saveSettingsFile(filePath: string, settings: Settings): Promise<void> {
  await writeJsonAtomic(filePath, settings);
}
