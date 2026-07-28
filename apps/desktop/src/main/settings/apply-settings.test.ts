import { fc, test as propertyTest } from '@fast-check/vitest';
import { defaultSettings, type Settings } from '@recompose/contracts';
import { describe, expect, test } from 'vitest';

import type { SettingsEffects } from './apply-settings';

import { applySettings } from './apply-settings';

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

    applySettings(effects, { ...defaultSettings(), theme: 'dark' });

    expect(applied.themeSource).toBe('dark');
  });

  test('the menu bar carries an icon while the document asks for one', () => {
    const { effects, applied } = recordingEffects();

    applySettings(effects, { ...defaultSettings(), showInMenuBar: true });

    expect(applied.menuBarVisible).toBe(true);
  });

  test('the operating system launches recompose while the document asks for it', () => {
    const { effects, applied } = recordingEffects();

    applySettings(effects, { ...defaultSettings(), launchAtLogin: true });

    expect(applied.loginItem).toBe(true);
  });

  test('a document that asks for nothing turns all three back off', () => {
    const { effects, applied } = recordingEffects();

    applySettings(effects, {
      ...defaultSettings(),
      theme: 'light',
      showInMenuBar: false,
      launchAtLogin: false,
    });

    expect(applied).toEqual({ themeSource: 'light', menuBarVisible: false, loginItem: false });
  });

  propertyTest.prop([anySettings])('every document reaches all three effects', (fields) => {
    const { effects, applied } = recordingEffects();

    applySettings(effects, { ...defaultSettings(), ...fields });

    expect(applied).toEqual({
      themeSource: fields.theme,
      menuBarVisible: fields.showInMenuBar,
      loginItem: fields.launchAtLogin,
    });
  });
});
