import type { SystemState } from '@recompose/contracts';

export type LoginItemAvailability = SystemState['loginItem'];

export function loginItemAvailabilityFor(
  platform: NodeJS.Platform,
  packaged: boolean,
): LoginItemAvailability {
  if (platform !== 'darwin' && platform !== 'win32') {
    return 'unsupported';
  }

  return packaged ? 'available' : 'unpackaged';
}

type LoginItemTarget = {
  path: string;
  args: string[];
};

export type LoginItemPort = {
  getLoginItemSettings: (options: LoginItemTarget) => { openAtLogin: boolean };
  setLoginItemSettings: (settings: LoginItemTarget & { openAtLogin: boolean }) => void;
};

export type LoginItem = {
  isEnabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
};

export function createLoginItem(
  port: LoginItemPort,
  availability: LoginItemAvailability,
  executablePath: string,
): LoginItem {
  const target: LoginItemTarget = { path: executablePath, args: [] };

  return {
    isEnabled: () => port.getLoginItemSettings(target).openAtLogin,
    setEnabled: (enabled) => {
      if (availability !== 'available') {
        return;
      }

      port.setLoginItemSettings({ ...target, openAtLogin: enabled });
    },
  };
}
