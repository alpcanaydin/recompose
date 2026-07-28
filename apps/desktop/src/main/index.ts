import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, clipboard, safeStorage, session, shell } from 'electron';
import { join } from 'path';

import type { IpcHandlers } from './ipc/dispatch';

import { registerIpcHandlers } from './ipc/register-ipc';
import { createStorageIpcHandlers } from './ipc/storage-ipc';
import { createSystemIpcHandlers } from './ipc/system-ipc';
import { installAppMenu } from './menu/app-menu';
import { resolvePasswordStoreOverride } from './password-store-override';
import { registerAppScheme, serveRenderer } from './protocol/app-protocol';
import { initializeStorage } from './storage/initialize-storage';
import { createSafeStorageCodec } from './storage/safe-storage-codec';
import { fileBrowserFor } from './system/file-browser';
import { createLoginItem, loginItemAvailabilityFor } from './system/login-item';
import { hideMenuBarTray, isMenuBarTrayVisible, showMenuBarTray } from './tray/menu-bar-tray';
import { resolveUserDataOverride } from './user-data-override';
import {
  createMainWindow,
  HOME_ROUTE,
  openSettingsSurface,
  showMainWindow,
} from './windows/main-window';
import { denyPermissionCheck, denyPermissionRequest } from './windows/permission-policy';
import { shouldQuitOnLastWindowClose } from './windows/quit-policy';

const trayMenuHandlers = {
  onOpenWindow: showMainWindow,
  onOpenSettings: openSettingsSurface,
  onQuit: () => {
    app.quit();
  },
};

function onStorageCorrupt(quarantinedPath: string): void {
  console.warn(`storage document quarantined: ${quarantinedPath}`);
}

function assembleIpcHandlers(): IpcHandlers {
  const userDataPath = app.getPath('userData');
  const loginItem = createLoginItem(
    app,
    loginItemAvailabilityFor(process.platform, app.isPackaged),
    process.execPath,
  );

  return {
    ...createStorageIpcHandlers({
      userDataPath,
      getCodec: () => createSafeStorageCodec(),
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      onCorrupt: onStorageCorrupt,
      writeClipboard: (text) => {
        clipboard.writeText(text);
      },
    }),
    ...createSystemIpcHandlers({
      fileBrowser: fileBrowserFor(process.platform),
      loginItem: loginItemAvailabilityFor(process.platform, app.isPackaged),
      configFolder: userDataPath,
      readLoginItem: () => loginItem.isEnabled(),
      isMenuBarVisible: () => isMenuBarTrayVisible(),
      openFolder: async (path) => shell.openPath(path),
    }),
  };
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

const userDataOverride = resolveUserDataOverride(process.env);

if (userDataOverride !== null) {
  app.setPath('userData', userDataOverride);
}

const passwordStoreOverride = resolvePasswordStoreOverride(process.env);

if (passwordStoreOverride !== null) {
  app.commandLine.appendSwitch('password-store', passwordStoreOverride);
}

registerAppScheme();

void app.whenReady().then(() => {
  serveRenderer(join(__dirname, '../renderer'));

  registerIpcHandlers(assembleIpcHandlers());

  void initializeStorage(app.getPath('userData'), onStorageCorrupt)
    .then((state) => {
      if (state.settings.showInMenuBar) {
        showMenuBarTray(trayMenuHandlers);
      }
    })
    .catch((error: unknown) => {
      console.error('storage initialization failed', error);
    });

  electronApp.setAppUserModelId('sh.recompose.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerPermissionHandlers();

  installAppMenu(openSettingsSurface);

  createMainWindow(HOME_ROUTE);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(HOME_ROUTE);
    }
  });
});

app.on('before-quit', () => {
  hideMenuBarTray();
});

app.on('window-all-closed', () => {
  if (shouldQuitOnLastWindowClose(process.platform, isMenuBarTrayVisible())) {
    app.quit();
  }
});
