import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { defaultSettings, loadSettings, settingsPatchSchema, withSettingsPatch } from './settings';

describe('app settings', () => {
  test('defaults: system theme and every switch off', () => {
    expect(defaultSettings()).toEqual({
      schemaVersion: 3,
      theme: 'system',
      launchAtLogin: false,
      showInMenuBar: false,
      requireGatewayToken: false,
    });
  });

  test('a stored settings file parses and keeps its shape', () => {
    const stored = {
      schemaVersion: 3,
      theme: 'dark',
      launchAtLogin: true,
      showInMenuBar: true,
      requireGatewayToken: true,
    };

    expect(loadSettings(stored)).toEqual(stored);
  });

  test('a document still naming a port is refused rather than quietly accepted', () => {
    expect(() => loadSettings({ ...defaultSettings(), enginePort: 8397 })).toThrow();
  });

  test('unknown keys are rejected', () => {
    expect(() => loadSettings({ ...defaultSettings(), telemetry: true })).toThrow();
  });

  test('a missing switch is rejected rather than quietly defaulted', () => {
    const { requireGatewayToken, ...withoutTheSwitch } = defaultSettings();

    expect(requireGatewayToken).toBe(false);
    expect(() => loadSettings(withoutTheSwitch)).toThrow();
  });
});

describe('a stored version 2 document, the shape a real profile holds', () => {
  test('the port a real profile still carries is dropped rather than reported as damage', () => {
    const storedUnderVersionTwo = {
      schemaVersion: 2,
      theme: 'system',
      enginePort: 8397,
      launchAtLogin: false,
      showInMenuBar: true,
      requireGatewayToken: false,
    };

    expect(loadSettings(storedUnderVersionTwo)).toEqual({
      schemaVersion: 3,
      theme: 'system',
      launchAtLogin: false,
      showInMenuBar: true,
      requireGatewayToken: false,
    });
  });

  const versionTwoDocuments = fc.record({
    schemaVersion: fc.constant(2),
    theme: fc.constantFrom('system', 'light', 'dark'),
    enginePort: fc.integer({ min: 1024, max: 65535 }),
    launchAtLogin: fc.boolean(),
    showInMenuBar: fc.boolean(),
    requireGatewayToken: fc.boolean(),
  });

  test.prop([versionTwoDocuments])(
    'every version 2 document reaches version 3 keeping its choices and losing only the port',
    (storedUnderVersionTwo) => {
      const { enginePort, ...withoutThePort } = storedUnderVersionTwo;

      expect(enginePort).toBeGreaterThan(0);
      expect(loadSettings(storedUnderVersionTwo)).toEqual({
        ...withoutThePort,
        schemaVersion: 3,
      });
    },
  );
});

describe('a stored version 1 document', () => {
  test('it migrates through both steps, keeping the theme and losing the port', () => {
    const storedUnderVersionOne = { schemaVersion: 1, theme: 'dark', enginePort: 9000 };

    expect(loadSettings(storedUnderVersionOne)).toEqual({
      schemaVersion: 3,
      theme: 'dark',
      launchAtLogin: false,
      showInMenuBar: false,
      requireGatewayToken: false,
    });
  });

  const versionOneDocuments = fc.record({
    schemaVersion: fc.constant(1),
    theme: fc.constantFrom('system', 'light', 'dark'),
    enginePort: fc.integer({ min: 1024, max: 65535 }),
  });

  test.prop([versionOneDocuments])(
    'every version 1 document reaches version 3 with its theme intact and its switches off',
    (storedUnderVersionOne) => {
      expect(loadSettings(storedUnderVersionOne)).toEqual({
        schemaVersion: 3,
        theme: storedUnderVersionOne.theme,
        launchAtLogin: false,
        showInMenuBar: false,
        requireGatewayToken: false,
      });
    },
  );
});

describe('a save that names only the fields it changes', () => {
  test('a named field replaces what the document held', () => {
    const stored = { ...defaultSettings(), theme: 'light' as const };

    expect(withSettingsPatch(stored, { theme: 'dark' })).toMatchObject({ theme: 'dark' });
  });

  test('a field the patch leaves out keeps what the document held', () => {
    const stored = { ...defaultSettings(), launchAtLogin: true, showInMenuBar: true };

    expect(withSettingsPatch(stored, { theme: 'dark' })).toEqual({ ...stored, theme: 'dark' });
  });

  test('a field named as undefined is left out rather than written back as nothing', () => {
    const stored = { ...defaultSettings(), launchAtLogin: true };

    expect(withSettingsPatch(stored, { launchAtLogin: undefined })).toEqual(stored);
  });

  test('a patch that names nothing leaves the document as it stands', () => {
    const stored = { ...defaultSettings(), showInMenuBar: true };

    expect(withSettingsPatch(stored, {})).toEqual(stored);
  });

  test('a patch cannot name the schema version, because only a migration moves it', () => {
    expect(settingsPatchSchema.safeParse({ theme: 'dark' }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ schemaVersion: 3 }).success).toBe(false);
  });

  test('the schema version a patch can never name survives every merge', () => {
    expect(withSettingsPatch(defaultSettings(), { theme: 'dark' }).schemaVersion).toBe(
      defaultSettings().schemaVersion,
    );
  });
});
