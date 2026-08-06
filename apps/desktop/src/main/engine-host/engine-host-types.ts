import type {
  EngineDirective,
  EngineGateway,
  EngineSpendGrant,
  EngineStates,
  EngineSubscriptionCredentialUpdated,
  GatewayEngineState,
  KeyCheckReport,
  KeyProviderId,
  LookCustody,
  ModelListing,
  RuntimeReachability,
} from '@recompose/contracts';

import type { SpendGrantFor } from './engine-spend';

export type EngineChild = {
  postMessage: (
    message: EngineDirective | EngineSpendGrant | EngineSubscriptionCredentialUpdated,
  ) => void;
  onMessage: (listener: (message: unknown) => void) => void;
  onExit: (listener: (code: number) => void) => void;
  kill: () => void;
};

export type EngineHostDeps = {
  knownSlugs: readonly string[];
  spawnChild: () => EngineChild;
  grantFor: SpendGrantFor;
  storeSubscriptionCredential?: (
    provider: 'anthropic' | 'openai',
    accountId: string,
    credential: string,
  ) => Promise<void>;
};

export type EngineHost = {
  start: (gateway: EngineGateway) => Promise<GatewayEngineState>;
  stop: (slug: string) => Promise<GatewayEngineState>;
  restart: (gateway: EngineGateway) => Promise<GatewayEngineState>;
  probe: (provider: KeyProviderId, key: string) => Promise<KeyCheckReport>;
  probeRuntime: (address: string) => Promise<RuntimeReachability>;
  listModels: (origin: string, custody: LookCustody) => Promise<ModelListing>;
  states: () => EngineStates;
  onStatesChanged: (listener: (states: EngineStates) => void) => () => void;
  dispose: () => void;
};
