import { is } from '@electron-toolkit/utils';
import { BrowserWindow, shell } from 'electron';
import { join } from 'path';

import icon from '../../../resources/icon.png?asset';
import { devServerOrigin } from '../environment/dev-server-origin';
import {
  decideExternalOpen,
  isAllowedNavigation,
  type NavigationPolicy,
} from './navigation-policy';
import {
  getStartedRouteFor,
  newGatewayRouteFor,
  rendererBaseFor,
  rendererUrlFor,
  settingsShortcutRouteFor,
} from './renderer-url';
import { windowOptionsFor } from './window-options';

const isMac = process.platform === 'darwin';

export const HOME_ROUTE = '/';

function rendererBase(): string {
  const { ELECTRON_RENDERER_URL: devServerUrl } = process.env;

  return rendererBaseFor(is.dev, devServerUrl);
}

function targetForLog(url: string): string {
  return URL.canParse(url) ? new URL(url).origin : 'a malformed target';
}

function applyGlassBackdrop(window: BrowserWindow): void {
  window.webContents.once('did-finish-load', () => {
    void import('electron-liquid-glass').then(({ default: liquidGlass }) => {
      liquidGlass.addView(window.getNativeWindowHandle(), { opaque: false });
    });
  });
}

export function createMainWindow(route: string): void {
  const mainWindow = new BrowserWindow(
    windowOptionsFor(process.platform, join(__dirname, '../preload/index.js'), icon),
  );

  if (isMac) {
    applyGlassBackdrop(mainWindow);
  }

  mainWindow.on('ready-to-show', () => {
    if (process.env['RECOMPOSE_WINDOW_STAYS_BACK'] === '1') {
      mainWindow.showInactive();
    } else {
      mainWindow.show();
    }
  });

  const navigationPolicy: NavigationPolicy = { devServerOrigin: devServerOrigin(is.dev) };

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, navigationPolicy)) {
      event.preventDefault();
      console.warn(`blocked navigation to ${targetForLog(url)}`);
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (decideExternalOpen(details.url) === 'open-https') {
      shell.openExternal(details.url).catch((error: unknown) => {
        console.error(`failed to open ${targetForLog(details.url)} externally`, error);
      });
    } else {
      console.warn(`dropped window-open to ${targetForLog(details.url)}`);
    }

    return { action: 'deny' };
  });

  void mainWindow.loadURL(rendererUrlFor(rendererBase(), route));
}

function reveal(window: BrowserWindow): void {
  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

export function showMainWindow(): void {
  const [openWindow] = BrowserWindow.getAllWindows();

  if (openWindow === undefined) {
    createMainWindow(HOME_ROUTE);

    return;
  }

  reveal(openWindow);
}

let shortcutPresses = 0;

function pressCount(): number {
  shortcutPresses += 1;

  return shortcutPresses;
}

function openSurface(routeFor: (press: number) => string): void {
  const [openWindow] = BrowserWindow.getAllWindows();

  if (openWindow === undefined) {
    createMainWindow(routeFor(pressCount()));

    return;
  }

  reveal(openWindow);

  const route = routeFor(pressCount());

  if (openWindow.webContents.getURL().startsWith(rendererBase())) {
    void openWindow.webContents.executeJavaScript(
      `location.hash = ${JSON.stringify(route)};`,
      true,
    );

    return;
  }

  void openWindow.webContents.loadURL(rendererUrlFor(rendererBase(), route));
}

export function openSettingsSurface(): void {
  openSurface(settingsShortcutRouteFor);
}

export function openNewGatewaySurface(): void {
  openSurface(newGatewayRouteFor);
}

export function openGetStartedSurface(): void {
  openSurface(getStartedRouteFor);
}
