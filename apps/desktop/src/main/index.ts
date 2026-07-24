import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, safeStorage, session } from 'electron';
import { join } from 'path';

import { registerIpcHandlers } from './ipc/register-ipc';
import { createStorageIpcHandlers } from './ipc/storage-ipc';
import { registerAppScheme, serveRenderer } from './protocol/app-protocol';
import { initializeStorage } from './storage/initialize-storage';
import { createSafeStorageCodec } from './storage/safe-storage-codec';
import { createMainWindow } from './windows/main-window';
import { denyPermissionCheck, denyPermissionRequest } from './windows/permission-policy';

function onStorageCorrupt(quarantinedPath: string): void {
  console.warn(`storage document quarantined: ${quarantinedPath}`);
}

function registerPermissionHandlers(): void {
  const permissionRequestHandler = (
    _webContents: unknown,
    _permission: string,
    callback: (allowed: boolean) => void,
  ) => {
    callback(denyPermissionRequest());
  };

  session.defaultSession.setPermissionRequestHandler(permissionRequestHandler);

  const permissionCheckHandler = () => denyPermissionCheck();

  session.defaultSession.setPermissionCheckHandler(permissionCheckHandler);
}

registerAppScheme();

void app.whenReady().then(() => {
  serveRenderer(join(__dirname, '../renderer'));

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

  registerPermissionHandlers();

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
