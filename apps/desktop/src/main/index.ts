import { electronApp, optimizer } from '@electron-toolkit/utils';
import { defaultSettings, type Settings } from '@recompose/contracts';
import { app, BrowserWindow, clipboard, nativeTheme, safeStorage, session, shell } from 'electron';
import { join } from 'path';

import type { IpcHandlers } from './ipc/dispatch';
import type { SettingsEffects } from './settings/apply-settings';

import { registerIpcHandlers } from './ipc/register-ipc';
import { createStorageIpcHandlers } from './ipc/storage-ipc';
import { createSystemIpcHandlers } from './ipc/system-ipc';
import { installAppMenu } from './menu/app-menu';
import { resolvePasswordStoreOverride } from './password-store-override';
import { registerAppScheme, serveRenderer } from './protocol/app-protocol';
import { applyBootSettings, applyChosenSettings } from './settings/apply-settings';
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

app.setName('Recompose');
app.setAboutPanelOptions({ applicationName: 'Recompose' });

const trayMenuHandlers = {
  onOpenWindow: showMainWindow,
  onOpenSettings: openSettingsSurface,
  onQuit: () => {
    app.quit();
  },
};

if (process.platform === 'linux') {
  safeStorage.setUsePlainTextEncryption(true);
}

const loginItemAvailability = loginItemAvailabilityFor(process.platform, app.isPackaged);

const loginItem = createLoginItem(app, loginItemAvailability, process.execPath);

const settingsEffects: SettingsEffects = {
  setThemeSource: (theme) => {
    nativeTheme.themeSource = theme;
  },
  setMenuBarVisible: (visible) => {
    if (visible) {
      showMenuBarTray(trayMenuHandlers);
    } else {
      hideMenuBarTray();
    }
  },
  setLoginItem: (enabled) => {
    loginItem.setEnabled(enabled);
  },
};

function applyChosenSettingsNow(settings: Settings, askedLoginItem: boolean | undefined): void {
  try {
    applyChosenSettings(settingsEffects, settings, askedLoginItem);
  } catch (error) {
    console.error('recompose stored the settings but could not apply them', error);
  }
}

function applySettingsAtBoot(settings: Settings): void {
  try {
    applyBootSettings(settingsEffects, settings);
  } catch (error) {
    console.error('recompose could not apply its stored settings at boot', error);
  }
}

function onStorageCorrupt(quarantinedPath: string): void {
  console.warn(`storage document quarantined: ${quarantinedPath}`);
}

function assembleIpcHandlers(): IpcHandlers {
  const userDataPath = app.getPath('userData');

  return {
    ...createStorageIpcHandlers({
      userDataPath,
      getCodec: () => createSafeStorageCodec(),
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      onCorrupt: onStorageCorrupt,
      writeClipboard: (text) => {
        clipboard.writeText(text);
      },
      homeFolder: app.getPath('home'),
      readLoginItem: () => loginItem.isEnabled(),
      applySettings: applyChosenSettingsNow,
    }),
    ...createSystemIpcHandlers({
      fileBrowser: fileBrowserFor(process.platform),
      loginItem: loginItemAvailability,
      configFolder: userDataPath,
      homeFolder: app.getPath('home'),
      readLoginItem: () => loginItem.isEnabled(),
      isMenuBarVisible: () => isMenuBarTrayVisible(),
      openFolder: async (path) => shell.openPath(path),
    }),
  };
}

async function storedSettings(): Promise<Settings> {
  try {
    const state = await initializeStorage(app.getPath('userData'), onStorageCorrupt);

    return state.settings;
  } catch (error) {
    console.error('storage initialization failed', error);

    return defaultSettings();
  }
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

async function startRecompose(): Promise<void> {
  serveRenderer(join(__dirname, '../renderer'));

  registerIpcHandlers(assembleIpcHandlers());

  electronApp.setAppUserModelId('sh.recompose.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerPermissionHandlers();

  installAppMenu(openSettingsSurface);

  applySettingsAtBoot(await storedSettings());

  createMainWindow(HOME_ROUTE);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(HOME_ROUTE);
    }
  });
}

void app
  .whenReady()
  .then(startRecompose)
  .catch((error: unknown) => {
    console.error('recompose failed to start', error);
  });

app.on('before-quit', () => {
  hideMenuBarTray();
});

app.on('window-all-closed', () => {
  if (shouldQuitOnLastWindowClose(process.platform, isMenuBarTrayVisible())) {
    app.quit();
  }
});
