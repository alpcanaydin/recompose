import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, safeStorage } from 'electron';

import { registerIpcHandlers } from './ipc/register-ipc';
import { createStorageIpcHandlers } from './ipc/storage-ipc';
import { initializeStorage } from './storage/initialize-storage';
import { createSafeStorageCodec } from './storage/safe-storage-codec';
import { createMainWindow } from './windows/main-window';

function onStorageCorrupt(quarantinedPath: string): void {
  console.warn(`storage document quarantined: ${quarantinedPath}`);
}

void app.whenReady().then(() => {
  registerIpcHandlers(
    createStorageIpcHandlers({
      userDataPath: app.getPath('userData'),
      getCodec: () => createSafeStorageCodec(),
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      onCorrupt: onStorageCorrupt,
    }),
  );

  void initializeStorage(app.getPath('userData'), onStorageCorrupt).catch((error: unknown) => {
    console.error('storage initialization failed', error);
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
