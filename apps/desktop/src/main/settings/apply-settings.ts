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

export function applyChosenSettings(effects: SettingsEffects, settings: Settings): void {
  applyPresentation(effects, settings);
  effects.setLoginItem(settings.launchAtLogin);
}

export function applyBootSettings(effects: SettingsEffects, settings: Settings): void {
  applyPresentation(effects, settings);
}
