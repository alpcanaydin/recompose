import { electronApp, optimizer } from '@electron-toolkit/utils';
import { type EngineStates } from '@recompose/contracts';
import { app, BrowserWindow, nativeTheme, safeStorage, shell } from 'electron';
import { join } from 'path';

import type { EngineHost } from './engine-host/engine-host';
import type { SpendGrantFor } from './engine-host/engine-spend';
import type { SpendGrantContext } from './engine-host/spend-grant';
import type { IpcHandlers } from './ipc/dispatch';
import type { KeyCheckIpcContext } from './ipc/key-check-ipc';
import type { StorageIpcContext } from './ipc/storage-context';
import type { SettingsEffects } from './settings/apply-settings';
import type { CredentialCustody } from './subscriptions/credential-custody';

import { createEngineHost } from './engine-host/engine-host';
import { createGatewayLifecycleRequests } from './engine-host/gateway-lifecycle-requests';
import { probeFreePort } from './engine-host/probe-free-port';
import { spawnEngineChild } from './engine-host/spawn-engine';
import { resolveSpendGrant } from './engine-host/spend-grant';
import { createEngineIpcHandlers } from './ipc/engine-ipc';
import { createKeyCheckIpcHandlers } from './ipc/key-check-ipc';
import { createLocalRuntimesIpcHandlers } from './ipc/local-runtimes-ipc';
import { createProviderModelsIpcHandlers, providerModelsReach } from './ipc/provider-models-ipc';
import { registerIpcHandlers } from './ipc/register-ipc';
import { storagePathsFor } from './ipc/storage-context';
import { createStorageIpcHandlers } from './ipc/storage-ipc';
import { createSubscriptionsIpcHandlers } from './ipc/subscriptions-ipc';
import { createSystemIpcHandlers } from './ipc/system-ipc';
import { installAppMenu } from './menu/app-menu';
import { resolvePasswordStoreOverride } from './password-store-override';
import { registerAppScheme, serveRenderer } from './protocol/app-protocol';
import {
  applyBootSettingsOrComplain,
  applyChosenSettingsOrComplain,
} from './settings/apply-settings';
import { storedBootState } from './storage/boot-state';
import { listGatewayConfigs } from './storage/gateway-store';
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
import { registerPermissionHandlers } from './windows/permission-wiring';
import { shouldQuitOnLastWindowClose } from './windows/quit-policy';
import { windowButtonsMoveOn } from './windows/window-buttons';

app.setName('Recompose');
app.setAboutPanelOptions({ applicationName: 'Recompose' });

let engineHost: EngineHost | null = null;

const gatewayLifecycle = createGatewayLifecycleRequests({
  host: () => engineHost,
  userDataPath: () => app.getPath('userData'),
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

function serveRewrittenGateway(engineHost: EngineHost): StorageIpcContext['restartGateway'] {
  return (gateway) => {
    engineHost.restart(gateway).catch((error: unknown) => {
      console.error(`recompose rewrote ${gateway.slug} but could not serve it again`, error);
    });
  };
}

function storageReach(): SpendGrantContext {
  return {
    userDataPath: app.getPath('userData'),
    homeFolder: app.getPath('home'),
    getCodec: () => createSafeStorageCodec(),
    onCorrupt: onStorageCorrupt,
  };
}

function storageContext(
  engineHost: EngineHost,
  custody: CredentialCustody | null,
): StorageIpcContext {
  const reach = storageReach();

  return {
    ...reach,
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    readLoginItem: () => loginItem.isEnabled(),
    applySettings: (settings, askedLoginItem) => {
      applyChosenSettingsOrComplain(settingsEffects, settings, askedLoginItem);
    },
    startGateway: startStoredGateway(engineHost),
    restartGateway: serveRewrittenGateway(engineHost),
    isServing: (slug) => engineHost.states()[slug]?.status === 'running',
    releaseSubscription: subscriptionRelease(
      subscriptionHomes(reach.userDataPath, process.platform),
      custody,
    ),
  };
}

function keyCheckContext(engineHost: EngineHost): KeyCheckIpcContext {
  return { ...storageReach(), probe: async (provider, key) => engineHost.probe(provider, key) };
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
    ...createStorageIpcHandlers(storageContext(engineHost, custody)),
    ...createKeyCheckIpcHandlers(keyCheckContext(engineHost)),
    ...createProviderModelsIpcHandlers(providerModelsReach(storageReach(), engineHost)),
    ...createLocalRuntimesIpcHandlers({
      userDataPath,
      homeFolder,
      onCorrupt: onStorageCorrupt,
      probeRuntime: async (address) => engineHost.probeRuntime(address),
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

function pushEngineStates(states: EngineStates): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('engine:state', states);
  }
}

function repaintTray(states: EngineStates): void {
  listGatewayConfigs(storagePathsFor(app.getPath('userData')).gatewaysDir, onStorageCorrupt)
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

  const boot = await storedBootState(app.getPath('userData'), onStorageCorrupt);

  const grantFor: SpendGrantFor = async (slug, model) =>
    resolveSpendGrant(storageReach(), slug, model);

  engineHost = createEngineHost({ knownSlugs: boot.slugs, spawnChild: spawnEngineChild, grantFor });
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

  applyBootSettingsOrComplain(settingsEffects, boot.settings);

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
