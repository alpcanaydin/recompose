import type { BrowserWindowConstructorOptions } from 'electron';

import { windowButtonsFor } from './window-buttons';

export function windowOptionsFor(
  platform: NodeJS.Platform,
  preloadPath: string,
  iconPath: string,
): BrowserWindowConstructorOptions {
  return {
    width: 1120,
    height: 780,
    minWidth: 720,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    ...(platform === 'darwin'
      ? {
          transparent: true,
          titleBarStyle: 'hidden' as const,
          trafficLightPosition: windowButtonsFor(true),
        }
      : {}),
    ...(platform === 'linux' ? { icon: iconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
    },
  };
}
