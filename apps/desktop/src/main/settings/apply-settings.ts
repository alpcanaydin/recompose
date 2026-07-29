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
 * @summary The login item only takes a write when this save changed it, because the operating
 * system owns that flag between saves and a stored value would otherwise undo a removal made there.
 */
export function applyChosenSettings(
  effects: SettingsEffects,
  settings: Settings,
  previous: Settings,
): void {
  applyPresentation(effects, settings);

  if (settings.launchAtLogin !== previous.launchAtLogin) {
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
