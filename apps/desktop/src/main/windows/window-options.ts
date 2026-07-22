import type { BrowserWindowConstructorOptions } from 'electron';

export function windowOptionsFor(
  platform: NodeJS.Platform,
  preloadPath: string,
  iconPath: string,
): BrowserWindowConstructorOptions {
  return {
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(platform === 'darwin'
      ? {
          transparent: true,
          titleBarStyle: 'hiddenInset' as const,
        }
      : {}),
    ...(platform === 'linux' ? { icon: iconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
    },
  };
}
