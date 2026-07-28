export type TrayMenuHandlers = {
  onOpenWindow: () => void;
  onOpenSettings: () => void;
  onQuit: () => void;
};

export type TrayMenuItem = {
  label?: string;
  type?: 'separator';
  click?: () => void;
};

export function buildTrayMenuTemplate(handlers: TrayMenuHandlers): TrayMenuItem[] {
  return [
    { label: 'Open recompose', click: handlers.onOpenWindow },
    { label: 'Settings…', click: handlers.onOpenSettings },
    { type: 'separator' },
    { label: 'Quit recompose', click: handlers.onQuit },
  ];
}
