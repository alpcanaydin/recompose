import { is } from '@electron-toolkit/utils';
import { BrowserWindow, shell } from 'electron';
import liquidGlass from 'electron-liquid-glass';
import { join } from 'path';

import icon from '../../../resources/icon.png?asset';
import { devServerOrigin } from '../environment/dev-server-origin';
import {
  decideExternalOpen,
  isAllowedNavigation,
  type NavigationPolicy,
} from './navigation-policy';
import { windowOptionsFor } from './window-options';

const isMac = process.platform === 'darwin';

function applyGlassBackdrop(window: BrowserWindow): void {
  window.webContents.once('did-finish-load', () => {
    liquidGlass.addView(window.getNativeWindowHandle(), { opaque: false });
  });
}

export function createMainWindow(): void {
  const mainWindow = new BrowserWindow(
    windowOptionsFor(process.platform, join(__dirname, '../preload/index.js'), icon),
  );

  if (isMac) {
    applyGlassBackdrop(mainWindow);
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  const navigationPolicy: NavigationPolicy = { devServerOrigin: devServerOrigin(is.dev) };

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, navigationPolicy)) {
      event.preventDefault();
      console.warn(`blocked navigation to ${url}`);
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (decideExternalOpen(details.url) === 'open-https') {
      void shell.openExternal(details.url);
    } else {
      console.warn(`dropped window-open to ${details.url}`);
    }

    return { action: 'deny' };
  });

  const { ELECTRON_RENDERER_URL: rendererUrl } = process.env;

  if (is.dev && rendererUrl !== undefined && rendererUrl !== '') {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadURL('app://renderer/index.html');
  }
}
