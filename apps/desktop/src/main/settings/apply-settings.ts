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
 * @summary The login item takes a write only when the save named it, because the operating system
 * owns that flag between saves. A save that never mentions it leaves a removal made outside the app
 * standing, and a person whose stored value drifted from the machine can still move the switch.
 */
export function applyChosenSettings(
  effects: SettingsEffects,
  settings: Settings,
  askedLoginItem: boolean | undefined,
): void {
  applyPresentation(effects, settings);

  if (askedLoginItem !== undefined) {
    effects.setLoginItem(askedLoginItem);
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
