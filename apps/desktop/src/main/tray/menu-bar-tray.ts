import type { EngineStates } from '@recompose/contracts';
import type { MenuItemConstructorOptions, NativeImage } from 'electron';

import { Menu, nativeImage, Tray } from 'electron';

import restartTemplate from '../../../resources/restartTemplate.png?asset';
import restartTemplateRetina from '../../../resources/restartTemplate@2x.png?asset';
import startTemplate from '../../../resources/startTemplate.png?asset';
import startTemplateRetina from '../../../resources/startTemplate@2x.png?asset';
import stopTemplate from '../../../resources/stopTemplate.png?asset';
import stopTemplateRetina from '../../../resources/stopTemplate@2x.png?asset';
import trayColoured from '../../../resources/tray.png?asset';
import trayTemplate from '../../../resources/trayTemplate.png?asset';
import trayTemplateRetina from '../../../resources/trayTemplate@2x.png?asset';
import { trayIconFor } from './tray-icon';
import {
  buildTrayMenuTemplate,
  type TrayGateway,
  type TrayIconSource,
  type TrayLifecycleIcons,
  type TrayMenuHandlers,
  type TrayMenuItem,
} from './tray-menu-template';

const LIFECYCLE_ICONS: TrayLifecycleIcons = {
  start: { source: startTemplate, retinaSource: startTemplateRetina },
  stop: { source: stopTemplate, retinaSource: stopTemplateRetina },
  restart: { source: restartTemplate, retinaSource: restartTemplateRetina },
};

let menuBarTray: Tray | null = null;
let shownHandlers: TrayMenuHandlers | null = null;
let shownGateways: readonly TrayGateway[] = [];
let shownStates: EngineStates = {};

function retinaAware(source: string, retinaSource: string, template: boolean): NativeImage {
  const icon = nativeImage.createFromPath(source);

  icon.addRepresentation({
    scaleFactor: 2,
    dataURL: nativeImage.createFromPath(retinaSource).toDataURL(),
  });
  icon.setTemplateImage(template);

  return icon;
}

function trayIcon(): NativeImage {
  const chosen = trayIconFor(process.platform, {
    template: trayTemplate,
    templateRetina: trayTemplateRetina,
    coloured: trayColoured,
  });

  if (chosen.retinaSource === null) {
    const icon = nativeImage.createFromPath(chosen.source);

    icon.setTemplateImage(chosen.template);

    return icon;
  }

  return retinaAware(chosen.source, chosen.retinaSource, chosen.template);
}

function menuIcon(icon: TrayIconSource): NativeImage {
  return retinaAware(icon.source, icon.retinaSource, process.platform === 'darwin');
}

function asElectronMenu(items: TrayMenuItem[]): MenuItemConstructorOptions[] {
  return items.map(({ icon, submenu, ...rest }) => ({
    ...rest,
    ...(icon === undefined ? {} : { icon: menuIcon(icon) }),
    ...(submenu === undefined ? {} : { submenu: asElectronMenu(submenu) }),
  }));
}

function paintContextMenu(tray: Tray, handlers: TrayMenuHandlers): void {
  tray.setContextMenu(
    Menu.buildFromTemplate(
      asElectronMenu(
        buildTrayMenuTemplate({
          handlers,
          icons: LIFECYCLE_ICONS,
          gateways: shownGateways,
          states: shownStates,
        }),
      ),
    ),
  );
}

export function isMenuBarTrayVisible(): boolean {
  return menuBarTray !== null && !menuBarTray.isDestroyed();
}

export function showMenuBarTray(handlers: TrayMenuHandlers): void {
  shownHandlers = handlers;

  if (isMenuBarTrayVisible()) {
    return;
  }

  const tray = new Tray(trayIcon());

  tray.setToolTip('recompose');
  paintContextMenu(tray, handlers);

  menuBarTray = tray;
}

/**
 * Repaints the tray menu from the ledger snapshot rather than from the event that arrived.
 *
 * @summary A burst of pushes must leave the last rebuild reflecting the last state.
 */
export function refreshMenuBarTray(gateways: readonly TrayGateway[], states: EngineStates): void {
  shownGateways = gateways;
  shownStates = states;

  if (menuBarTray !== null && isMenuBarTrayVisible() && shownHandlers !== null) {
    paintContextMenu(menuBarTray, shownHandlers);
  }
}

export function hideMenuBarTray(): void {
  menuBarTray?.destroy();
}
