import type { NativeImage } from 'electron';

import { Menu, nativeImage, Tray } from 'electron';

import trayColoured from '../../../resources/tray.png?asset';
import trayTemplate from '../../../resources/trayTemplate.png?asset';
import trayTemplateRetina from '../../../resources/trayTemplate@2x.png?asset';
import { trayIconSourceFor } from './tray-icon';
import { buildTrayMenuTemplate, type TrayMenuHandlers } from './tray-menu-template';

const isMac = process.platform === 'darwin';

// A collected Tray drops its icon out of the menu bar with no error, so the reference stays here.
let menuBarTray: Tray | null = null;

function trayIcon(): NativeImage {
  const icon = nativeImage.createFromPath(
    trayIconSourceFor(process.platform, { template: trayTemplate, coloured: trayColoured }),
  );

  if (isMac) {
    icon.addRepresentation({
      scaleFactor: 2,
      dataURL: nativeImage.createFromPath(trayTemplateRetina).toDataURL(),
    });
    icon.setTemplateImage(true);
  }

  return icon;
}

export function isMenuBarTrayVisible(): boolean {
  return menuBarTray !== null;
}

export function showMenuBarTray(handlers: TrayMenuHandlers): void {
  if (menuBarTray !== null) {
    return;
  }

  const tray = new Tray(trayIcon());

  tray.setToolTip('recompose');
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate(handlers)));

  menuBarTray = tray;
}

export function hideMenuBarTray(): void {
  menuBarTray?.destroy();
  menuBarTray = null;
}
