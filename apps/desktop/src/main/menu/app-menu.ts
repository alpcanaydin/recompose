import { Menu } from 'electron';

import { buildAppMenuTemplate } from './app-menu-template';

export function installAppMenu(onOpenSettings: () => void): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(buildAppMenuTemplate(process.platform, onOpenSettings)),
  );
}
