import type { AccountsDocument, RecomposeIpc, Settings, SystemState } from '@recompose/contracts';

import { defaultSettings } from '@recompose/contracts';

const emptyDocument: AccountsDocument = { schemaVersion: 1, accounts: [] };

const observedSystem: SystemState = {
  fileBrowser: 'finder',
  loginItem: 'available',
  loginItemEnabled: false,
  menuBarVisible: false,
  configFolder: '~/Library/Application Support/recompose',
};

export type BridgeParameters = {
  accounts?: AccountsDocument;
  settings?: Settings;
  overrides?: Partial<RecomposeIpc>;
};

type SettingsHandlers = Pick<RecomposeIpc, 'settings:get' | 'settings:save'>;
type AccountHandlers = Pick<RecomposeIpc, 'accounts:list' | 'accounts:connect' | 'accounts:remove'>;
type SystemHandlers = Pick<RecomposeIpc, 'system:get' | 'system:open-config-folder'>;
type GatewayTokenHandlers = Pick<
  RecomposeIpc,
  'gateway-token:status' | 'gateway-token:mint' | 'gateway-token:copy'
>;

function settingsHandlers(seed: Settings): SettingsHandlers {
  let stored = seed;

  return {
    'settings:get': async () => Promise.resolve({ ok: true, value: stored }),
    'settings:save': async (settings) => {
      stored = settings;

      return Promise.resolve({ ok: true, value: stored });
    },
  };
}

function accountHandlers(seed: AccountsDocument): AccountHandlers {
  let registry = seed;
  let nextAccountNumber = registry.accounts.length + 1;

  return {
    'accounts:list': async () => Promise.resolve({ ok: true, value: registry }),
    'accounts:connect': async (request) => {
      const id = `a${nextAccountNumber}`;

      nextAccountNumber += 1;

      registry = {
        ...registry,
        accounts: [
          ...registry.accounts,
          {
            id,
            provider: request.provider,
            kind: request.kind,
            label: request.label,
            credentialRef: `c-${id}`,
          },
        ],
      };

      return Promise.resolve({ ok: true, value: registry });
    },
    'accounts:remove': async (request) => {
      registry = {
        ...registry,
        accounts: registry.accounts.filter((row) => row.id !== request.id),
      };

      return Promise.resolve({ ok: true, value: registry });
    },
  };
}

function systemHandlers(): SystemHandlers {
  return {
    'system:get': async () => Promise.resolve({ ok: true, value: observedSystem }),
    'system:open-config-folder': async () => Promise.resolve({ ok: true, value: undefined }),
  };
}

function gatewayTokenHandlers(): GatewayTokenHandlers {
  let masked: string | null = null;
  let mints = 0;

  return {
    'gateway-token:status': async () =>
      Promise.resolve({ ok: true, value: { masked, storage: 'available' } }),
    'gateway-token:mint': async () => {
      mints += 1;
      masked = `rc-local-••••••••tok${mints}`;

      return Promise.resolve({ ok: true, value: { masked, storage: 'available' } });
    },
    'gateway-token:copy': async () =>
      Promise.resolve(
        masked === null
          ? { ok: false, error: { code: 'token-missing', message: 'no token to copy' } }
          : { ok: true, value: undefined },
      ),
  };
}

export function installFakeBridge(parameters: BridgeParameters = {}): void {
  window.recompose = {
    'gateways:list': async () => Promise.resolve({ ok: true, value: [] }),
    'gateways:save': async () => Promise.resolve({ ok: true, value: [] }),
    ...settingsHandlers(parameters.settings ?? defaultSettings()),
    ...accountHandlers(parameters.accounts ?? emptyDocument),
    ...systemHandlers(),
    ...gatewayTokenHandlers(),
    ...parameters.overrides,
  };
}
