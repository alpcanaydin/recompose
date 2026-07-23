import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow } from 'electron';

import { initializeStorage } from './storage/initialize-storage';
import { createMainWindow } from './windows/main-window';

void app.whenReady().then(() => {
  void initializeStorage(app.getPath('userData'), (quarantinedPath) => {
    console.warn(`storage document quarantined: ${quarantinedPath}`);
  });

  electronApp.setAppUserModelId('sh.recompose.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
