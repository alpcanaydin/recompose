import { z } from 'zod';

import { migrateDocument, type Migration } from './migration';

export const SETTINGS_VERSION = 1;

export const settingsSchema = z.strictObject({
  schemaVersion: z.literal(SETTINGS_VERSION),
  theme: z.enum(['system', 'light', 'dark']),
  enginePort: z.int().min(1024).max(65535),
});

export type Settings = z.infer<typeof settingsSchema>;

const settingsMigrations: readonly Migration[] = [];

export function loadSettings(doc: unknown): Settings {
  return settingsSchema.parse(migrateDocument(doc, settingsMigrations, SETTINGS_VERSION));
}

export function defaultSettings(): Settings {
  return { schemaVersion: SETTINGS_VERSION, theme: 'system', enginePort: 8397 };
}
