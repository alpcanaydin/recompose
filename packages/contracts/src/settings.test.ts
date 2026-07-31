import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import {
  defaultSettings,
  loadSettings,
  SETTINGS_VERSION,
  settingsPatchSchema,
  withSettingsPatch,
} from './settings';

describe('app settings', () => {
  test('defaults: system theme and every switch off', () => {
    expect(defaultSettings()).toEqual({
      schemaVersion: SETTINGS_VERSION,
      theme: 'system',
      launchAtLogin: false,
      showInMenuBar: false,
    });
  });

  test('a stored settings file parses and keeps its shape', () => {
    const stored = {
      schemaVersion: SETTINGS_VERSION,
      theme: 'dark',
      launchAtLogin: true,
      showInMenuBar: true,
    };

    expect(loadSettings(stored)).toEqual(stored);
  });

  test('a document still naming a port is refused rather than quietly accepted', () => {
    expect(() => loadSettings({ ...defaultSettings(), enginePort: 8397 })).toThrow();
  });

  test('a document still naming a token requirement is refused rather than quietly accepted', () => {
    expect(() => loadSettings({ ...defaultSettings(), requireGatewayToken: false })).toThrow();
  });

  test('unknown keys are rejected', () => {
    expect(() => loadSettings({ ...defaultSettings(), telemetry: true })).toThrow();
  });

  test('a missing switch is rejected rather than quietly defaulted', () => {
    const { showInMenuBar, ...withoutTheSwitch } = defaultSettings();

    expect(showInMenuBar).toBe(false);
    expect(() => loadSettings(withoutTheSwitch)).toThrow();
  });
});

describe('a stored version 3 document, the shape written while the token switch existed', () => {
  test('the retired switch is dropped rather than reported as damage', () => {
    const storedUnderVersionThree = {
      schemaVersion: 3,
      theme: 'dark',
      launchAtLogin: true,
      showInMenuBar: true,
      requireGatewayToken: false,
    };

    expect(loadSettings(storedUnderVersionThree)).toEqual({
      schemaVersion: SETTINGS_VERSION,
      theme: 'dark',
      launchAtLogin: true,
      showInMenuBar: true,
    });
  });

  const versionThreeDocuments = fc.record({
    schemaVersion: fc.constant(3),
    theme: fc.constantFrom('system', 'light', 'dark'),
    launchAtLogin: fc.boolean(),
    showInMenuBar: fc.boolean(),
    requireGatewayToken: fc.boolean(),
  });

  test.prop([versionThreeDocuments])(
    'every version 3 document keeps its choices and loses only the retired switch',
    (storedUnderVersionThree) => {
      const { requireGatewayToken, ...whatSurvives } = storedUnderVersionThree;

      expect(typeof requireGatewayToken).toBe('boolean');
      expect(loadSettings(storedUnderVersionThree)).toEqual({
        ...whatSurvives,
        schemaVersion: SETTINGS_VERSION,
      });
    },
  );
});

describe('a stored version 2 document, the shape a real profile holds', () => {
  test('the port and the token requirement are dropped rather than reported as damage', () => {
    const storedUnderVersionTwo = {
      schemaVersion: 2,
      theme: 'system',
      enginePort: 8397,
      launchAtLogin: false,
      showInMenuBar: true,
      requireGatewayToken: true,
    };

    expect(loadSettings(storedUnderVersionTwo)).toEqual({
      schemaVersion: SETTINGS_VERSION,
      theme: 'system',
      launchAtLogin: false,
      showInMenuBar: true,
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
    'every version 2 document reaches the current version keeping its choices and losing both retired fields',
    (storedUnderVersionTwo) => {
      const { enginePort, requireGatewayToken, ...whatSurvives } = storedUnderVersionTwo;

      expect(enginePort).toBeGreaterThan(0);
      expect(typeof requireGatewayToken).toBe('boolean');
      expect(loadSettings(storedUnderVersionTwo)).toEqual({
        ...whatSurvives,
        schemaVersion: SETTINGS_VERSION,
      });
    },
  );
});

describe('a stored version 1 document', () => {
  test('it migrates through every step, keeping the theme and losing the port', () => {
    const storedUnderVersionOne = { schemaVersion: 1, theme: 'dark', enginePort: 9000 };

    expect(loadSettings(storedUnderVersionOne)).toEqual({
      schemaVersion: SETTINGS_VERSION,
      theme: 'dark',
      launchAtLogin: false,
      showInMenuBar: false,
    });
  });

  const versionOneDocuments = fc.record({
    schemaVersion: fc.constant(1),
    theme: fc.constantFrom('system', 'light', 'dark'),
    enginePort: fc.integer({ min: 1024, max: 65535 }),
  });

  test.prop([versionOneDocuments])(
    'every version 1 document reaches the current version with its theme intact and its switches off',
    (storedUnderVersionOne) => {
      expect(loadSettings(storedUnderVersionOne)).toEqual({
        schemaVersion: SETTINGS_VERSION,
        theme: storedUnderVersionOne.theme,
        launchAtLogin: false,
        showInMenuBar: false,
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
    expect(settingsPatchSchema.safeParse({ schemaVersion: SETTINGS_VERSION }).success).toBe(false);
  });

  test('the schema version a patch can never name survives every merge', () => {
    expect(withSettingsPatch(defaultSettings(), { theme: 'dark' }).schemaVersion).toBe(
      defaultSettings().schemaVersion,
    );
  });
});
