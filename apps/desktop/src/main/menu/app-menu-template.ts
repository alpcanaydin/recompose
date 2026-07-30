import type { MenuItemConstructorOptions } from 'electron';

export type AppMenuItem = {
  label?: string;
  role?: NonNullable<MenuItemConstructorOptions['role']>;
  accelerator?: string;
  type?: 'separator';
  click?: () => void;
  submenu?: AppMenuItem[];
};

function settingsItem(onOpenSettings: () => void): AppMenuItem {
  return { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: onOpenSettings };
}

function macApplicationMenu(onOpenSettings: () => void): AppMenuItem {
  return {
    label: 'Recompose',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      settingsItem(onOpenSettings),
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  };
}

function fileMenu(onOpenSettings: () => void): AppMenuItem {
  return {
    label: 'File',
    submenu: [settingsItem(onOpenSettings), { type: 'separator' }, { role: 'quit' }],
  };
}

export function buildAppMenuTemplate(
  platform: NodeJS.Platform,
  onOpenSettings: () => void,
): AppMenuItem[] {
  return [
    platform === 'darwin' ? macApplicationMenu(onOpenSettings) : fileMenu(onOpenSettings),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
}
