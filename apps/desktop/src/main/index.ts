import { electronApp, optimizer } from '@electron-toolkit/utils';
import { defaultSettings, type EngineStates, type Settings } from '@recompose/contracts';
import { app, BrowserWindow, nativeTheme, safeStorage, session, shell } from 'electron';
import { join } from 'path';

import type { EngineHost } from './engine-host/engine-host';
import type { IpcHandlers } from './ipc/dispatch';
import type { StorageIpcContext } from './ipc/storage-context';
import type { SettingsEffects } from './settings/apply-settings';

import { createEngineHost } from './engine-host/engine-host';
import { createGatewayLifecycleRequests } from './engine-host/gateway-lifecycle-requests';
import { probeFreePort } from './engine-host/probe-free-port';
import { spawnEngineChild } from './engine-host/spawn-engine';
import { createEngineIpcHandlers } from './ipc/engine-ipc';
import { registerIpcHandlers } from './ipc/register-ipc';
import { createStorageIpcHandlers } from './ipc/storage-ipc';
import { createSubscriptionsIpcHandlers } from './ipc/subscriptions-ipc';
import { createSystemIpcHandlers } from './ipc/system-ipc';
import { installAppMenu } from './menu/app-menu';
import { resolvePasswordStoreOverride } from './password-store-override';
import { registerAppScheme, serveRenderer } from './protocol/app-protocol';
import { applyBootSettings, applyChosenSettings } from './settings/apply-settings';
import { listGatewayConfigs } from './storage/gateway-store';
import { initializeStorage } from './storage/initialize-storage';
import { createSafeStorageCodec } from './storage/safe-storage-codec';
import { subscriptionHomes } from './subscriptions/subscription-homes';
import { subscriptionRelease } from './subscriptions/subscription-release';
import { machineCustody, subscriptionsContext } from './subscriptions/subscriptions-wiring';
import { fileBrowserFor } from './system/file-browser';
import { createLoginItem, loginItemAvailabilityFor } from './system/login-item';
import {
  hideMenuBarTray,
  isMenuBarTrayVisible,
  refreshMenuBarTray,
  showMenuBarTray,
} from './tray/menu-bar-tray';
import { resolveUserDataOverride } from './user-data-override';
import {
  createMainWindow,
  HOME_ROUTE,
  openGetStartedSurface,
  openNewGatewaySurface,
  openSettingsSurface,
  showMainWindow,
} from './windows/main-window';
import { allowsPermission } from './windows/permission-policy';
import { shouldQuitOnLastWindowClose } from './windows/quit-policy';
import { windowButtonsMoveOn } from './windows/window-buttons';

app.setName('Recompose');
app.setAboutPanelOptions({ applicationName: 'Recompose' });

let engineHost: EngineHost | null = null;

function gatewaysDir(): string {
  return join(app.getPath('userData'), 'gateways');
}

const gatewayLifecycle = createGatewayLifecycleRequests({
  host: () => engineHost,
  gatewaysDir,
  onCorrupt: (quarantinedPath) => {
    onStorageCorrupt(quarantinedPath);
  },
});

const trayMenuHandlers = {
  onOpenWindow: showMainWindow,
  onOpenSettings: openSettingsSurface,
  onQuit: () => {
    app.quit();
  },
  onStartGateway: gatewayLifecycle.start,
  onStopGateway: gatewayLifecycle.stop,
  onRestartGateway: gatewayLifecycle.restart,
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

function startStoredGateway(engineHost: EngineHost): StorageIpcContext['startGateway'] {
  return (gateway) => {
    engineHost.start(gateway).catch((error: unknown) => {
      console.error(`recompose stored ${gateway.slug} but could not start it`, error);
    });
  };
}

function assembleIpcHandlers(engineHost: EngineHost): IpcHandlers {
  const userDataPath = app.getPath('userData');
  const homeFolder = app.getPath('home');
  const custody = machineCustody();

  return {
    ...createSubscriptionsIpcHandlers(
      subscriptionsContext({ userDataPath, homeFolder, custody, onCorrupt: onStorageCorrupt }),
    ),
    ...createEngineIpcHandlers({
      host: engineHost,
      userDataPath,
      homeFolder,
      onCorrupt: onStorageCorrupt,
      probeFreePort,
    }),
    ...createStorageIpcHandlers({
      userDataPath,
      getCodec: () => createSafeStorageCodec(),
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      onCorrupt: onStorageCorrupt,
      homeFolder,
      readLoginItem: () => loginItem.isEnabled(),
      applySettings: applyChosenSettingsNow,
      startGateway: startStoredGateway(engineHost),
      releaseSubscription: subscriptionRelease(
        subscriptionHomes(userDataPath, process.platform),
        custody,
      ),
      checkKey: async () => Promise.resolve({ verdict: 'could-not-check' as const }),
    }),
    ...createSystemIpcHandlers({
      fileBrowser: fileBrowserFor(process.platform),
      loginItem: loginItemAvailability,
      configFolder: userDataPath,
      homeFolder,
      readLoginItem: () => loginItem.isEnabled(),
      isMenuBarVisible: () => isMenuBarTrayVisible(),
      openFolder: async (path) => shell.openPath(path),
      placeWindowButtons: (position) => {
        if (!windowButtonsMoveOn(process.platform)) {
          return;
        }

        BrowserWindow.getAllWindows()[0]?.setWindowButtonPosition(position);
      },
    }),
  };
}

type BootState = { settings: Settings; slugs: string[] };

async function storedState(): Promise<BootState> {
  try {
    const state = await initializeStorage(app.getPath('userData'), onStorageCorrupt);

    return { settings: state.settings, slugs: state.gateways.map((gateway) => gateway.slug) };
  } catch (error) {
    console.error('storage initialization failed', error);

    return { settings: defaultSettings(), slugs: [] };
  }
}

function pushEngineStates(states: EngineStates): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('engine:state', states);
  }
}

function repaintTray(states: EngineStates): void {
  listGatewayConfigs(gatewaysDir(), onStorageCorrupt)
    .then((stored) => {
      refreshMenuBarTray(
        stored.map((gateway) => ({ slug: gateway.slug, displayName: gateway.displayName })),
        states,
      );
    })
    .catch((error: unknown) => {
      console.error('recompose could not read its gateways for the menu bar', error);
    });
}

function registerPermissionHandlers(): void {
  const permissionRequestHandler = (
    _webContents: unknown,
    permission: string,
    callback: (allowed: boolean) => void,
  ) => {
    callback(allowsPermission(permission));
  };

  session.defaultSession.setPermissionRequestHandler(permissionRequestHandler);

  const permissionCheckHandler = (_webContents: unknown, permission: string) =>
    allowsPermission(permission);

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

  const boot = await storedState();

  engineHost = createEngineHost({ knownSlugs: boot.slugs, spawnChild: spawnEngineChild });
  engineHost.onStatesChanged(pushEngineStates);
  engineHost.onStatesChanged(repaintTray);
  repaintTray(engineHost.states());

  registerIpcHandlers(assembleIpcHandlers(engineHost));

  electronApp.setAppUserModelId('sh.recompose.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerPermissionHandlers();

  installAppMenu({
    onOpenSettings: openSettingsSurface,
    onNewGateway: openNewGatewaySurface,
    onShowGetStarted: openGetStartedSurface,
  });

  applySettingsAtBoot(boot.settings);

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
  engineHost?.dispose();
});

app.on('window-all-closed', () => {
  if (shouldQuitOnLastWindowClose(process.platform, isMenuBarTrayVisible())) {
    app.quit();
  }
});
