import type { EngineStates } from '@recompose/contracts';

export type TrayMenuHandlers = {
  onOpenWindow: () => void;
  onOpenSettings: () => void;
  onQuit: () => void;
  onStartGateway: (slug: string) => void;
  onStopGateway: (slug: string) => void;
  onRestartGateway: (slug: string) => void;
};

export type TrayIconSource = {
  source: string;
  retinaSource: string;
};

export type TrayLifecycleIcons = {
  start: TrayIconSource;
  stop: TrayIconSource;
  restart: TrayIconSource;
};

export type TrayGateway = {
  slug: string;
  displayName: string;
};

export type TrayMenuItem = {
  label?: string;
  type?: 'separator';
  enabled?: boolean;
  icon?: TrayIconSource;
  click?: () => void;
  submenu?: TrayMenuItem[];
};

export type TrayMenuInput = {
  handlers: TrayMenuHandlers;
  icons: TrayLifecycleIcons;
  gateways: readonly TrayGateway[];
  states: EngineStates;
};

function gatewaySubmenu(input: TrayMenuInput, gateway: TrayGateway): TrayMenuItem[] {
  const { handlers, icons } = input;
  const serving = input.states[gateway.slug]?.status === 'running';

  return [
    {
      label: 'Start',
      icon: icons.start,
      enabled: !serving,
      click: () => {
        handlers.onStartGateway(gateway.slug);
      },
    },
    {
      label: 'Stop',
      icon: icons.stop,
      enabled: serving,
      click: () => {
        handlers.onStopGateway(gateway.slug);
      },
    },
    {
      label: 'Restart',
      icon: icons.restart,
      enabled: serving,
      click: () => {
        handlers.onRestartGateway(gateway.slug);
      },
    },
  ];
}

function gatewaySection(input: TrayMenuInput): TrayMenuItem[] {
  if (input.gateways.length === 0) {
    return [{ label: 'No gateways yet', enabled: false }, { type: 'separator' as const }];
  }

  return [
    ...input.gateways.map((gateway) => ({
      label: gateway.displayName,
      submenu: gatewaySubmenu(input, gateway),
    })),
    { type: 'separator' as const },
  ];
}

export function buildTrayMenuTemplate(input: TrayMenuInput): TrayMenuItem[] {
  const { handlers } = input;

  return [
    { label: 'Open recompose', click: handlers.onOpenWindow },
    { label: 'Settings…', click: handlers.onOpenSettings },
    { type: 'separator' },
    ...gatewaySection(input),
    { label: 'Quit recompose', click: handlers.onQuit },
  ];
}
