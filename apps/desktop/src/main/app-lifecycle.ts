import { app, BrowserWindow } from 'electron';

import { hideMenuBarTray, isMenuBarTrayVisible } from './tray/menu-bar-tray';
import { shouldQuitOnLastWindowClose } from './windows/quit-policy';

type AppLifecycle = {
  start: () => Promise<void>;
  activate: () => void;
  dispose: () => void;
};

export function registerAppLifecycle(lifecycle: AppLifecycle): void {
  void app
    .whenReady()
    .then(lifecycle.start)
    .catch((error: unknown) => {
      console.error('recompose failed to start', error);
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      lifecycle.activate();
    }
  });

  app.on('before-quit', () => {
    hideMenuBarTray();
    lifecycle.dispose();
  });
  app.on('window-all-closed', () => {
    if (shouldQuitOnLastWindowClose(process.platform, isMenuBarTrayVisible())) {
      app.quit();
    }
  });
}
