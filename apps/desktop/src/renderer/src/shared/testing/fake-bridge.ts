import type {
  AccountsDocument,
  EngineStates,
  GatewayConfig,
  RecomposeIpc,
  RecomposeIpcEvents,
  Settings,
  SubscriptionAccountView,
  SubscriptionTool,
  SystemState,
} from '@recompose/contracts';

import { withSettingsPatch, defaultSettings, ipcChannels } from '@recompose/contracts';

import { noSubscriptions, noTools, subscriptionHandlers } from './fake-subscriptions';

const emptyDocument: AccountsDocument = { schemaVersion: 2, accounts: [] };

const observedSystem: SystemState = {
  fileBrowser: 'finder',
  loginItem: 'available',
  loginItemEnabled: false,
  menuBarVisible: false,
  configFolder: '~/Library/Application Support/recompose',
};

export type GatewaySeed = {
  /** Identifier the gateway stores under and answers to. */
  slug: string;
  /** Name the sidebar and the toolbar show. */
  displayName: string;
  /** Loopback port the gateway binds. */
  port: number;
};

/** A stored gateway document, filled out around the three fields a scenario cares about. */
export function gatewaySeed({ slug, displayName, port }: GatewaySeed): GatewayConfig {
  return {
    schemaVersion: 1,
    slug,
    displayName,
    port,
    virtualModels: [],
    layout: { nodes: {} },
  };
}

export type BridgeParameters = {
  accounts?: AccountsDocument;
  settings?: Settings;
  gateways?: readonly GatewayConfig[];
  engineStates?: EngineStates;
  subscriptions?: readonly SubscriptionAccountView[];
  tools?: readonly SubscriptionTool[];
  overrides?: Partial<RecomposeIpc>;
};

type SettingsHandlers = Pick<RecomposeIpc, 'settings:get' | 'settings:save'>;
type AccountHandlers = Pick<RecomposeIpc, 'accounts:list' | 'accounts:connect' | 'accounts:remove'>;
type SystemHandlers = Pick<
  RecomposeIpc,
  'system:get' | 'system:open-config-folder' | 'system:sidebar-shown'
>;
type GatewayHandlers = Pick<
  RecomposeIpc,
  | 'gateways:list'
  | 'gateways:save'
  | 'gateways:offer-port'
  | 'gateways:move-port'
  | 'engine:start'
  | 'engine:stop'
  | 'engine:states'
>;

const FIRST_OFFERED_PORT = 51234;

type EngineStatesListener = (states: EngineStates) => void;

const engineStateListeners = new Set<EngineStatesListener>();

/**
 * Pushes a lifecycle snapshot at everything listening, the way the main process would.
 *
 * @summary Reach for it in a story or a spec that has to show state arriving on its own, with
 * nothing on screen having asked for it.
 */
export function emitEngineStates(states: EngineStates): void {
  for (const listener of engineStateListeners) {
    listener(states);
  }
}

function conflictIn(
  stored: readonly GatewayConfig[],
  arriving: GatewayConfig,
): { code: 'name-conflict' | 'port-conflict'; message: string } | undefined {
  const namesake = stored.find((held) => held.slug === arriving.slug);

  if (namesake !== undefined) {
    return {
      code: 'name-conflict',
      message: `Another gateway already holds the name "${namesake.displayName}".`,
    };
  }

  const portHolder = stored.find((held) => held.port === arriving.port);

  if (portHolder !== undefined) {
    return { code: 'port-conflict', message: `${portHolder.slug} already holds this port.` };
  }

  return undefined;
}

function refusalSaving(
  stored: readonly GatewayConfig[],
  arriving: GatewayConfig,
): { code: 'validation-failed' | 'name-conflict' | 'port-conflict'; message: string } | undefined {
  const parsed = ipcChannels['gateways:save'].request.safeParse(arriving);

  return parsed.success
    ? conflictIn(stored, parsed.data)
    : { code: 'validation-failed', message: parsed.error.message };
}

function gatewayHandlers(
  seededGateways: readonly GatewayConfig[],
  seededStates: EngineStates,
): GatewayHandlers {
  let stored = [...seededGateways];
  let states = { ...seededStates };

  function freePort(): number {
    let offer = FIRST_OFFERED_PORT;

    while (stored.some((gateway) => gateway.port === offer)) {
      offer += 1;
    }

    return offer;
  }

  function report(slug: string, state: EngineStates[string]): EngineStates {
    states = { ...states, [slug]: state };
    emitEngineStates(states);

    return states;
  }

  return {
    'gateways:list': async () => Promise.resolve({ ok: true, value: stored }),
    'gateways:save': async (gateway) => {
      const refused = refusalSaving(stored, gateway);

      if (refused !== undefined) {
        return Promise.resolve({ ok: false, error: refused });
      }

      stored = [...stored, gateway];
      report(gateway.slug, { status: 'running' });

      return Promise.resolve({ ok: true, value: stored });
    },
    'gateways:offer-port': async () => Promise.resolve({ ok: true, value: freePort() }),
    'gateways:move-port': async ({ slug }) => {
      const moved = freePort();

      stored = stored.map((gateway) =>
        gateway.slug === slug ? { ...gateway, port: moved } : gateway,
      );
      report(slug, { status: 'running' });

      return Promise.resolve({ ok: true, value: stored });
    },
    'engine:start': async ({ slug }) => {
      report(slug, { status: 'running' });

      return Promise.resolve({ ok: true, value: { status: 'running' } });
    },
    'engine:stop': async ({ slug }) => {
      report(slug, { status: 'stopped' });

      return Promise.resolve({ ok: true, value: { status: 'stopped' } });
    },
    'engine:states': async () => Promise.resolve({ ok: true, value: states }),
  };
}

function settingsHandlers(seed: Settings): SettingsHandlers {
  let stored = seed;

  return {
    'settings:get': async () => Promise.resolve({ ok: true, value: stored }),
    'settings:save': async (patch) => {
      stored = withSettingsPatch(stored, patch);

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
    'system:sidebar-shown': async () => Promise.resolve({ ok: true, value: undefined }),
  };
}

function eventBridge(): RecomposeIpcEvents {
  return {
    'engine:state': (listener) => {
      engineStateListeners.add(listener);

      return () => {
        engineStateListeners.delete(listener);
      };
    },
  };
}

const noGateways: readonly GatewayConfig[] = [];
const noEngineStates: EngineStates = {};

function seedsFrom(parameters: BridgeParameters) {
  return {
    settings: defaultSettings(),
    accounts: emptyDocument,
    gateways: noGateways,
    engineStates: noEngineStates,
    subscriptions: noSubscriptions,
    tools: noTools,
    ...parameters,
  };
}

export function installFakeBridge(parameters: BridgeParameters = {}): void {
  const seeds = seedsFrom(parameters);

  engineStateListeners.clear();

  window.recompose = {
    ...settingsHandlers(seeds.settings),
    ...accountHandlers(seeds.accounts),
    ...systemHandlers(),
    ...gatewayHandlers(seeds.gateways, seeds.engineStates),
    ...subscriptionHandlers(seeds.subscriptions, seeds.tools),
    ...parameters.overrides,
  };
  window.recomposeEvents = eventBridge();
}
