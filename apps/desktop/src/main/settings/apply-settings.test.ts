import { fc, test as propertyTest } from '@fast-check/vitest';
import { defaultSettings, type Settings } from '@recompose/contracts';
import { describe, expect, test } from 'vitest';

import type { SettingsEffects } from './apply-settings';

import { applyBootSettings, applyChosenSettings } from './apply-settings';

type Applied = {
  themeSource: Settings['theme'] | null;
  menuBarVisible: boolean | null;
  loginItem: boolean | null;
};

function recordingEffects(): { effects: SettingsEffects; applied: Applied } {
  const applied: Applied = { themeSource: null, menuBarVisible: null, loginItem: null };

  return {
    applied,
    effects: {
      setThemeSource: (theme) => {
        applied.themeSource = theme;
      },
      setMenuBarVisible: (visible) => {
        applied.menuBarVisible = visible;
      },
      setLoginItem: (enabled) => {
        applied.loginItem = enabled;
      },
    },
  };
}

const anySettings = fc.record({
  theme: fc.constantFrom<Settings['theme']>('system', 'light', 'dark'),
  launchAtLogin: fc.boolean(),
  showInMenuBar: fc.boolean(),
  requireGatewayToken: fc.boolean(),
  enginePort: fc.integer({ min: 1024, max: 65535 }),
});

describe('what a settings document changes outside the window', () => {
  test('the theme the document names is the theme the operating system paints', () => {
    const { effects, applied } = recordingEffects();

    applyChosenSettings(effects, { ...defaultSettings(), theme: 'dark' }, defaultSettings());

    expect(applied.themeSource).toBe('dark');
  });

  test('the menu bar carries an icon while the document asks for one', () => {
    const { effects, applied } = recordingEffects();

    applyChosenSettings(effects, { ...defaultSettings(), showInMenuBar: true }, defaultSettings());

    expect(applied.menuBarVisible).toBe(true);
  });

  test('the operating system launches recompose while the document asks for it', () => {
    const { effects, applied } = recordingEffects();

    applyChosenSettings(effects, { ...defaultSettings(), launchAtLogin: true }, defaultSettings());

    expect(applied.loginItem).toBe(true);
  });

  test('a document that asks for nothing turns all three back off', () => {
    const { effects, applied } = recordingEffects();

    applyChosenSettings(
      effects,
      { ...defaultSettings(), theme: 'light', showInMenuBar: false, launchAtLogin: false },
      { ...defaultSettings(), launchAtLogin: true },
    );

    expect(applied).toEqual({ themeSource: 'light', menuBarVisible: false, loginItem: false });
  });

  propertyTest.prop([anySettings])('every chosen document reaches all three effects', (fields) => {
    const { effects, applied } = recordingEffects();

    applyChosenSettings(
      effects,
      { ...defaultSettings(), ...fields },
      { ...defaultSettings(), launchAtLogin: !fields.launchAtLogin },
    );

    expect(applied).toEqual({
      themeSource: fields.theme,
      menuBarVisible: fields.showInMenuBar,
      loginItem: fields.launchAtLogin,
    });
  });
});

describe('what a stored document changes when the app merely starts', () => {
  test('boot never writes the login item, because the operating system owns it', () => {
    const { effects, applied } = recordingEffects();

    applyBootSettings(effects, { ...defaultSettings(), launchAtLogin: true });

    expect(applied.loginItem).toBeNull();
  });

  test('boot still paints the theme and places the tray', () => {
    const { effects, applied } = recordingEffects();

    applyBootSettings(effects, { ...defaultSettings(), theme: 'dark', showInMenuBar: true });

    expect(applied).toEqual({ themeSource: 'dark', menuBarVisible: true, loginItem: null });
  });

  propertyTest.prop([anySettings])('no stored document ever reaches the login item', (fields) => {
    const { effects, applied } = recordingEffects();

    applyBootSettings(effects, { ...defaultSettings(), ...fields });

    expect(applied.loginItem).toBeNull();
  });
});

describe('the login item a save does not touch', () => {
  test('an unrelated change leaves the operating system holding what it holds', () => {
    const { effects, applied } = recordingEffects();
    const stored: Settings = { ...defaultSettings(), launchAtLogin: true };

    applyChosenSettings(effects, { ...stored, theme: 'dark' }, stored);

    expect(applied.themeSource).toBe('dark');
    expect(applied.loginItem).toBeNull();
  });

  test('turning it off writes the removal', () => {
    const { effects, applied } = recordingEffects();
    const stored: Settings = { ...defaultSettings(), launchAtLogin: true };

    applyChosenSettings(effects, { ...stored, launchAtLogin: false }, stored);

    expect(applied.loginItem).toBe(false);
  });
});
