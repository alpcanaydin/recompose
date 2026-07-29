import type { Settings } from '@recompose/contracts';

export type SettingsEffects = {
  setThemeSource: (theme: Settings['theme']) => void;
  setMenuBarVisible: (visible: boolean) => void;
  setLoginItem: (enabled: boolean) => void;
};

function applyPresentation(effects: SettingsEffects, settings: Settings): void {
  effects.setThemeSource(settings.theme);
  effects.setMenuBarVisible(settings.showInMenuBar);
}

/**
 * Applies a document a person just saved.
 *
 * @summary The login item takes a write only when the save asks for something other than what the
 * machine already holds, so an unrelated save never undoes a removal made outside the app and a
 * person whose stored value drifted from the operating system can still move the switch.
 */
export function applyChosenSettings(
  effects: SettingsEffects,
  settings: Settings,
  held: Settings,
): void {
  applyPresentation(effects, settings);

  if (settings.launchAtLogin !== held.launchAtLogin) {
    effects.setLoginItem(settings.launchAtLogin);
  }
}

/**
 * Applies the document the app starts with.
 *
 * @summary Nobody chose anything yet, so the login item stays as the operating system holds it.
 */
export function applyBootSettings(effects: SettingsEffects, settings: Settings): void {
  applyPresentation(effects, settings);
}
