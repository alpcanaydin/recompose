import type { AccountsDocument, Settings, SystemState } from '@recompose/contracts';

import { ACCOUNTS_VERSION, defaultSettings } from '@recompose/contracts';

import type { IpcHandlers } from './dispatch';

const emptyAccounts: AccountsDocument = { schemaVersion: ACCOUNTS_VERSION, accounts: [] };

const observedSystem: SystemState = {
  fileBrowser: 'finder',
  loginItem: 'available',
  loginItemEnabled: false,
  menuBarVisible: false,
  configFolder: '/tmp/recompose',
};

export const darkSettings: Settings = { ...defaultSettings(), theme: 'dark' };

const refuses = async (): Promise<never> => Promise.reject(new Error('not under test'));

/**
 * A whole handler desk where nothing answers, to be overridden one channel at a time.
 *
 * @summary One list of channels serves every spec that needs a full desk, so a new channel is
 * declared here once rather than in each of them, and a spec that forgot it cannot pass by
 * accident.
 */
export function handlersWith(overrides: Partial<IpcHandlers>): IpcHandlers {
  return {
    'gateways:list': refuses,
    'gateways:save': refuses,
    'gateways:update': refuses,
    'settings:get': refuses,
    'settings:save': refuses,
    'accounts:list': refuses,
    'accounts:connect': refuses,
    'accounts:remove': refuses,
    'accounts:check-key': refuses,
    'accounts:connect-local': refuses,
    'accounts:detect-runtime': refuses,
    'accounts:check-runtime': refuses,
    'accounts:list-models': refuses,
    'system:get': refuses,
    'system:open-config-folder': refuses,
    'system:window-band': refuses,
    'gateways:offer-port': refuses,
    'gateways:move-port': refuses,
    'engine:start': refuses,
    'engine:stop': refuses,
    'engine:states': refuses,
    'subscriptions:list': refuses,
    'subscriptions:tools': refuses,
    'subscriptions:sign-in': refuses,
    'subscriptions:restore': refuses,
    'subscriptions:activate': refuses,
    ...overrides,
  };
}

/** A whole handler desk where every channel answers the emptiest thing its contract allows. */
export function alwaysSucceedingHandlers(): IpcHandlers {
  const noGateways = async () => Promise.resolve({ ok: true as const, value: [] });
  const theseAccounts = async () => Promise.resolve({ ok: true as const, value: emptyAccounts });
  const theseSettings = async () => Promise.resolve({ ok: true as const, value: darkSettings });
  const nothing = async () => Promise.resolve({ ok: true as const, value: undefined });
  const silentRuntime = async () =>
    Promise.resolve({ ok: true as const, value: { verdict: 'unreachable' as const } });

  return {
    'gateways:list': noGateways,
    'gateways:save': noGateways,
    'gateways:update': noGateways,
    'gateways:move-port': noGateways,
    'settings:get': theseSettings,
    'settings:save': theseSettings,
    'accounts:list': theseAccounts,
    'accounts:connect': theseAccounts,
    'accounts:remove': theseAccounts,
    'accounts:connect-local': theseAccounts,
    'accounts:check-key': async () =>
      Promise.resolve({ ok: true, value: { verdict: 'could-not-check' as const } }),
    'accounts:detect-runtime': silentRuntime,
    'accounts:check-runtime': silentRuntime,
    'accounts:list-models': async () =>
      Promise.resolve({ ok: true, value: { standing: 'unlisted' as const } }),
    'system:get': async () => Promise.resolve({ ok: true, value: observedSystem }),
    'system:open-config-folder': nothing,
    'system:window-band': nothing,
    'gateways:offer-port': async () => Promise.resolve({ ok: true, value: 51234 }),
    'engine:start': async () => Promise.resolve({ ok: true, value: { status: 'running' } }),
    'engine:stop': async () => Promise.resolve({ ok: true, value: { status: 'stopped' } }),
    'engine:states': async () => Promise.resolve({ ok: true, value: {} }),
    'subscriptions:list': noGateways,
    'subscriptions:tools': noGateways,
    'subscriptions:sign-in': noGateways,
    'subscriptions:restore': noGateways,
    'subscriptions:activate': noGateways,
  };
}
