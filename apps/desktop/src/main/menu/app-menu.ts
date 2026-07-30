import { Menu } from 'electron';

import { buildAppMenuTemplate, type AppMenuHandlers } from './app-menu-template';

export function installAppMenu(handlers: AppMenuHandlers): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildAppMenuTemplate(process.platform, handlers)));
}
