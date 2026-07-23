import { defaultSettings, loadSettings, type Settings } from '@recompose/contracts';

import { readDocumentWithQuarantine, writeJsonAtomic } from './json-file';

export async function loadSettingsFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<Settings> {
  const settings = await readDocumentWithQuarantine(filePath, loadSettings, onCorrupt);

  return settings ?? defaultSettings();
}

export async function saveSettingsFile(filePath: string, settings: Settings): Promise<void> {
  await writeJsonAtomic(filePath, settings);
}
