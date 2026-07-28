import { z } from 'zod';

import { migrateDocument, type Migration } from './migration';

export const SETTINGS_VERSION = 2;

export const ENGINE_PORT_RANGE = { min: 1024, max: 65535 } as const;

export const settingsSchema = z.strictObject({
  schemaVersion: z.literal(SETTINGS_VERSION),
  theme: z.enum(['system', 'light', 'dark']),
  enginePort: z.int().min(ENGINE_PORT_RANGE.min).max(ENGINE_PORT_RANGE.max),
  launchAtLogin: z.boolean(),
  showInMenuBar: z.boolean(),
  requireGatewayToken: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

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

const settingsMigrations: readonly Migration[] = [addVersionTwoSwitches];

export function loadSettings(doc: unknown): Settings {
  return settingsSchema.parse(migrateDocument(doc, settingsMigrations, SETTINGS_VERSION));
}

export function defaultSettings(): Settings {
  return {
    schemaVersion: SETTINGS_VERSION,
    theme: 'system',
    enginePort: 8397,
    launchAtLogin: false,
    showInMenuBar: false,
    requireGatewayToken: false,
  };
}
