import { z } from 'zod';

import { migrateDocument, type Migration } from './migration';

export const SETTINGS_VERSION = 3;

export const settingsSchema = z.strictObject({
  schemaVersion: z.literal(SETTINGS_VERSION),
  theme: z.enum(['system', 'light', 'dark']),
  launchAtLogin: z.boolean(),
  showInMenuBar: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const settingsPatchSchema = settingsSchema.omit({ schemaVersion: true }).partial();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/**
 * The document a patch leaves behind.
 *
 * @summary A patch names only the fields a save changes, so a field it leaves out keeps whatever
 * the document already held rather than being written back as undefined.
 */
export function withSettingsPatch(document: Settings, patch: SettingsPatch): Settings {
  const named = Object.entries(patch).filter(([, value]) => value !== undefined);

  return settingsSchema.parse({ ...document, ...Object.fromEntries(named) });
}

const addVersionTwoSwitches: Migration = {
  from: 1,
  migrate: (doc) => ({
    ...doc,
    schemaVersion: 2,
    launchAtLogin: false,
    showInMenuBar: false,
    requireGatewayToken: false,
  }),
};

const dropWhatBelongsToOneGateway: Migration = {
  from: 2,
  migrate: ({ enginePort: _port, requireGatewayToken: _requirement, ...whatSurvives }) => ({
    ...whatSurvives,
    schemaVersion: 3,
  }),
};

const settingsMigrations: readonly Migration[] = [
  addVersionTwoSwitches,
  dropWhatBelongsToOneGateway,
];

export function loadSettings(doc: unknown): Settings {
  return settingsSchema.parse(migrateDocument(doc, settingsMigrations, SETTINGS_VERSION));
}

export function defaultSettings(): Settings {
  return {
    schemaVersion: SETTINGS_VERSION,
    theme: 'system',
    launchAtLogin: false,
    showInMenuBar: false,
  };
}
