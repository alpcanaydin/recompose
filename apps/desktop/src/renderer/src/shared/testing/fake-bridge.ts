import type {
  AccountsDocument,
  EngineStates,
  GatewayConfig,
  KeyCheckVerdict,
  RecomposeIpc,
  RecomposeIpcEvents,
  RuntimeReachability,
  Settings,
  SubscriptionAccountView,
  SubscriptionTool,
  SystemState,
} from '@recompose/contracts';

import { ACCOUNTS_VERSION, withSettingsPatch, defaultSettings } from '@recompose/contracts';

import { accountHandlers } from './fake-accounts';
import {
  forgetEngineStateListeners,
  gatewayHandlers,
  listenForEngineStates,
} from './fake-gateways';
import { modelListHandlers, noModelLists, type SeededModelLists } from './fake-model-lists';
import { noSubscriptions, noTools, subscriptionHandlers } from './fake-subscriptions';

const emptyDocument: AccountsDocument = { schemaVersion: ACCOUNTS_VERSION, accounts: [] };

const observedSystem: SystemState = {
  fileBrowser: 'finder',
  loginItem: 'available',
  loginItemEnabled: false,
  menuBarVisible: false,
  configFolder: '~/Library/Application Support/recompose',
};

export type BridgeParameters = {
  accounts?: AccountsDocument;
  /** The verdict every key check answers, standing for what the provider says this run. */
  keyCheck?: KeyCheckVerdict;
  /** The reading every runtime look answers, standing for what the machine says this run. */
  reachability?: RuntimeReachability;
  settings?: Settings;
  /** The accounts whose model lists a look can read this run, and the ids each one serves. */
  providerModels?: SeededModelLists;
  gateways?: readonly GatewayConfig[];
  engineStates?: EngineStates;
  subscriptions?: readonly SubscriptionAccountView[];
  tools?: readonly SubscriptionTool[];
  overrides?: Partial<RecomposeIpc>;
};

type SettingsHandlers = Pick<RecomposeIpc, 'settings:get' | 'settings:save'>;
type SystemHandlers = Pick<
  RecomposeIpc,
  'system:get' | 'system:open-config-folder' | 'system:window-band'
>;

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

function systemHandlers(): SystemHandlers {
  return {
    'system:get': async () => Promise.resolve({ ok: true, value: observedSystem }),
    'system:open-config-folder': async () => Promise.resolve({ ok: true, value: undefined }),
    'system:window-band': async () => Promise.resolve({ ok: true, value: undefined }),
  };
}

function eventBridge(): RecomposeIpcEvents {
  return { 'engine:state': (listener) => listenForEngineStates(listener) };
}

const noGateways: readonly GatewayConfig[] = [];
const noEngineStates: EngineStates = {};
const unreachableProvider: KeyCheckVerdict = 'could-not-check';
const silentRuntime: RuntimeReachability = { verdict: 'unreachable' };

function seedsFrom(parameters: BridgeParameters) {
  return {
    settings: defaultSettings(),
    accounts: emptyDocument,
    keyCheck: unreachableProvider,
    reachability: silentRuntime,
    providerModels: noModelLists,
    gateways: noGateways,
    engineStates: noEngineStates,
    subscriptions: noSubscriptions,
    tools: noTools,
    ...parameters,
  };
}

export function installFakeBridge(parameters: BridgeParameters = {}): void {
  const seeds = seedsFrom(parameters);

  forgetEngineStateListeners();

  const { landSubscription, ...accounts } = accountHandlers(
    seeds.accounts,
    seeds.keyCheck,
    seeds.reachability,
  );

  window.recompose = {
    ...settingsHandlers(seeds.settings),
    ...accounts,
    ...systemHandlers(),
    ...gatewayHandlers(seeds.gateways, seeds.engineStates),
    ...modelListHandlers(seeds.providerModels),
    ...subscriptionHandlers(seeds.subscriptions, seeds.tools, landSubscription),
    ...parameters.overrides,
  };
  window.recomposeEvents = eventBridge();
}
