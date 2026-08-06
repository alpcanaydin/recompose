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

/**
 * Applies a saved document, writing down an effect the machine refused rather than throwing.
 *
 * @summary The document is already on disk by the time this runs, so an operating system that
 * refuses one effect must not read back as a save that failed. Nobody upstream has a decision left
 * to make, which is why the complaint is written here instead of carried out.
 */
export function applyChosenSettingsOrComplain(
  effects: SettingsEffects,
  settings: Settings,
  askedLoginItem: boolean | undefined,
): void {
  try {
    applyChosenSettings(effects, settings, askedLoginItem);
  } catch (error) {
    console.error('recompose stored the settings but could not apply them', error);
  }
}

/**
 * Applies the boot document, writing down an effect the machine refused rather than throwing.
 *
 * @summary A refusal at boot must not take the window down with it, because a person can still
 * reach the settings screen and move whatever did not take.
 */
export function applyBootSettingsOrComplain(effects: SettingsEffects, settings: Settings): void {
  try {
    applyBootSettings(effects, settings);
  } catch (error) {
    console.error('recompose could not apply its stored settings at boot', error);
  }
}
