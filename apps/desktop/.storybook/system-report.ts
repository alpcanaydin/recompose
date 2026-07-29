import type { SystemState } from '@recompose/contracts';

const observed: SystemState = {
  fileBrowser: 'finder',
  loginItem: 'available',
  loginItemEnabled: false,
  menuBarVisible: false,
  configFolder: '/Users/someone/Library/Application Support/recompose',
};

/**
 * Story parameters that make the app report the system state a scenario needs.
 *
 * @summary Reach for it in any story whose component reads `system:get`.
 */
export function reportingSystem(state: Partial<SystemState> = {}) {
  return {
    bridge: {
      overrides: {
        'system:get': async () =>
          Promise.resolve({ ok: true as const, value: { ...observed, ...state } }),
      },
    },
  };
}
