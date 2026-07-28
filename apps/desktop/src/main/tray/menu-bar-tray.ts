import type { NativeImage } from 'electron';

import { Menu, nativeImage, Tray } from 'electron';

import trayColoured from '../../../resources/tray.png?asset';
import trayTemplate from '../../../resources/trayTemplate.png?asset';
import trayTemplateRetina from '../../../resources/trayTemplate@2x.png?asset';
import { trayIconFor } from './tray-icon';
import { buildTrayMenuTemplate, type TrayMenuHandlers } from './tray-menu-template';

let menuBarTray: Tray | null = null;

function trayIcon(): NativeImage {
  const chosen = trayIconFor(process.platform, {
    template: trayTemplate,
    templateRetina: trayTemplateRetina,
    coloured: trayColoured,
  });

  const icon = nativeImage.createFromPath(chosen.source);

  if (chosen.retinaSource !== null) {
    icon.addRepresentation({
      scaleFactor: 2,
      dataURL: nativeImage.createFromPath(chosen.retinaSource).toDataURL(),
    });
  }

  icon.setTemplateImage(chosen.template);

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
