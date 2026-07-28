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
