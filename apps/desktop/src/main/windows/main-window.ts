import { is } from '@electron-toolkit/utils';
import { BrowserWindow, shell } from 'electron';
import liquidGlass from 'electron-liquid-glass';
import { join } from 'path';

import icon from '../../../resources/icon.png?asset';
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

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);

    return { action: 'deny' };
  });

  const { ELECTRON_RENDERER_URL: rendererUrl } = process.env;

  if (is.dev && rendererUrl !== undefined && rendererUrl !== '') {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}
