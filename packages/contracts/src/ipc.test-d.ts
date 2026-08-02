import { describe, expectTypeOf, test } from 'vitest';

import type {
  AccountsDocument,
  CredentialedAccount,
  EngineDirective,
  EngineGateway,
  EngineReport,
  EngineStates,
  GatewayConfig,
  GatewayEngineState,
  IpcChannel,
  IpcError,
  IpcEvent,
  IpcEventPayload,
  IpcRequest,
  IpcResponse,
  Migration,
  RecomposeIpc,
  RecomposeIpcEvents,
  Settings,
  SettingsPatch,
  SubscriptionAccount,
  SubscriptionAccountView,
  SubscriptionProviderId,
  SubscriptionTool,
  SystemState,
} from './index';

describe('ipc request contracts', () => {
  test('read channels take no payload', () => {
    expectTypeOf<IpcRequest<'gateways:list'>>().toEqualTypeOf<void>();
    expectTypeOf<IpcRequest<'settings:get'>>().toEqualTypeOf<void>();
    expectTypeOf<IpcRequest<'accounts:list'>>().toEqualTypeOf<void>();
  });

  test('write channels take exactly their domain payload', () => {
    expectTypeOf<IpcRequest<'gateways:save'>>().toEqualTypeOf<GatewayConfig>();
    expectTypeOf<IpcRequest<'settings:save'>>().toEqualTypeOf<SettingsPatch>();
    expectTypeOf<IpcRequest<'accounts:remove'>>().toEqualTypeOf<{ id: string }>();
  });

  test('saving settings names only the fields it changes, never the whole document', () => {
    expectTypeOf<IpcRequest<'settings:save'>>().not.toHaveProperty('schemaVersion');
    expectTypeOf<IpcRequest<'settings:save'>['launchAtLogin']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<IpcResponse<'settings:save'>>().toExtend<
      { ok: true; value: Settings } | { ok: false; error: IpcError }
    >();
  });

  test('connecting an account is the only channel that carries a secret inbound', () => {
    expectTypeOf<IpcRequest<'accounts:connect'>>().toHaveProperty('secret');
    expectTypeOf<IpcRequest<'accounts:connect'>['secret']>().toEqualTypeOf<string>();
    expectTypeOf<IpcRequest<'gateways:save'>>().not.toHaveProperty('secret');
  });

  test('the system channels act on the whole app, so neither takes a payload', () => {
    expectTypeOf<IpcRequest<'system:get'>>().toEqualTypeOf<void>();
    expectTypeOf<IpcRequest<'system:open-config-folder'>>().toEqualTypeOf<void>();
  });
});

describe('ipc response contracts', () => {
  test('every response is the closed result envelope', () => {
    expectTypeOf<IpcResponse<'accounts:list'>>().toEqualTypeOf<
      { ok: true; value: AccountsDocument } | { ok: false; error: IpcError }
    >();
    expectTypeOf<IpcResponse<'settings:save'>>().toEqualTypeOf<
      { ok: true; value: Settings } | { ok: false; error: IpcError }
    >();
  });

  test('error codes are a closed set the renderer can branch on', () => {
    expectTypeOf<IpcError['code']>().toEqualTypeOf<
      | 'vault-unavailable'
      | 'vault-newer-schema'
      | 'settings-newer-schema'
      | 'validation-failed'
      | 'storage-failed'
      | 'folder-open-failed'
      | 'name-conflict'
      | 'port-conflict'
      | 'tool-missing'
      | 'sign-in-timed-out'
      | 'keychain-denied'
    >();
  });

  test('the observed system state rides the result envelope', () => {
    expectTypeOf<IpcResponse<'system:get'>>().toEqualTypeOf<
      { ok: true; value: SystemState } | { ok: false; error: IpcError }
    >();
    expectTypeOf<SystemState>().not.toHaveProperty('platform');
  });

  test('account rows crossing the bridge are structurally secret-free', () => {
    expectTypeOf<AccountsDocument['accounts'][number]>().not.toHaveProperty('secret');
    expectTypeOf<CredentialedAccount>().toHaveProperty('credentialRef');
    expectTypeOf<SubscriptionAccount>().not.toHaveProperty('credentialRef');
  });
});

describe('the subscription channels', () => {
  test('reading the subscriptions and the tools takes no payload', () => {
    expectTypeOf<IpcRequest<'subscriptions:list'>>().toEqualTypeOf<void>();
    expectTypeOf<IpcRequest<'subscriptions:tools'>>().toEqualTypeOf<void>();
  });

  test('signing in names a provider, and the two acts on an account name an id', () => {
    expectTypeOf<IpcRequest<'subscriptions:sign-in'>>().toEqualTypeOf<{
      provider: SubscriptionProviderId;
    }>();
    expectTypeOf<IpcRequest<'subscriptions:restore'>>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<IpcRequest<'subscriptions:activate'>>().toEqualTypeOf<{ id: string }>();
  });

  test('no subscription request carries a secret, because the tool holds the credential', () => {
    expectTypeOf<IpcRequest<'subscriptions:sign-in'>>().not.toHaveProperty('secret');
    expectTypeOf<IpcRequest<'subscriptions:restore'>>().not.toHaveProperty('secret');
    expectTypeOf<IpcRequest<'subscriptions:activate'>>().not.toHaveProperty('secret');
  });

  test('every act on a subscription answers the refreshed views', () => {
    expectTypeOf<IpcResponse<'subscriptions:list'>>().toEqualTypeOf<
      { ok: true; value: SubscriptionAccountView[] } | { ok: false; error: IpcError }
    >();
    expectTypeOf<IpcResponse<'subscriptions:sign-in'>>().toEqualTypeOf<
      IpcResponse<'subscriptions:list'>
    >();
    expectTypeOf<IpcResponse<'subscriptions:restore'>>().toEqualTypeOf<
      IpcResponse<'subscriptions:list'>
    >();
    expectTypeOf<IpcResponse<'subscriptions:activate'>>().toEqualTypeOf<
      IpcResponse<'subscriptions:list'>
    >();
  });

  test('the tool report says whether the tool is there and what to run', () => {
    expectTypeOf<IpcResponse<'subscriptions:tools'>>().toEqualTypeOf<
      { ok: true; value: SubscriptionTool[] } | { ok: false; error: IpcError }
    >();
    expectTypeOf<SubscriptionTool['present']>().toEqualTypeOf<boolean>();
  });

  test('a view reports standing without carrying anything the tool signed in with', () => {
    expectTypeOf<SubscriptionAccountView['standing']>().toEqualTypeOf<'connected' | 'lapsed'>();
    expectTypeOf<SubscriptionAccountView>().not.toHaveProperty('credentialRef');
    expectTypeOf<SubscriptionAccountView>().not.toHaveProperty('secret');
  });
});

describe('the channels that act rather than read', () => {
  test('opening the config folder answers with nothing', () => {
    expectTypeOf<IpcResponse<'system:open-config-folder'>>().toEqualTypeOf<
      { ok: true; value: void } | { ok: false; error: IpcError }
    >();
  });
});

describe('bridge surface totality', () => {
  test('the bridge type covers every contract channel and nothing else', () => {
    expectTypeOf<keyof RecomposeIpc>().toEqualTypeOf<IpcChannel>();
  });

  test('no channel on the bridge serves a gateway token', () => {
    expectTypeOf<IpcChannel>().not.toEqualTypeOf<'gateway-token:status'>();
    expectTypeOf<Extract<IpcChannel, `gateway-token:${string}`>>().toEqualTypeOf<never>();
  });

  test('each bridge entry maps its channel request to a promised response', () => {
    expectTypeOf<RecomposeIpc['accounts:connect']>().toEqualTypeOf<
      (request: IpcRequest<'accounts:connect'>) => Promise<IpcResponse<'accounts:connect'>>
    >();
  });
});

describe('push surface totality', () => {
  test('the event bridge covers every contract event and nothing else', () => {
    expectTypeOf<keyof RecomposeIpcEvents>().toEqualTypeOf<IpcEvent>();
  });

  test('one event exists, and it is the state push', () => {
    expectTypeOf<IpcEvent>().toEqualTypeOf<'engine:state'>();
  });

  test('the push carries the whole snapshot rather than one gateway', () => {
    expectTypeOf<IpcEventPayload<'engine:state'>>().toEqualTypeOf<EngineStates>();
  });

  test('subscribing answers a disposer, so no listener outlives its subscriber', () => {
    expectTypeOf<RecomposeIpcEvents['engine:state']>().toEqualTypeOf<
      (listener: (payload: EngineStates) => void) => () => void
    >();
  });
});

describe('the state one gateway reports', () => {
  test('a gateway is either serving or stopped, and never a third thing', () => {
    expectTypeOf<GatewayEngineState['status']>().toEqualTypeOf<'running' | 'stopped'>();
  });

  test('only a stopped gateway can name the port its start lost', () => {
    expectTypeOf<Extract<GatewayEngineState, { status: 'running' }>>().not.toHaveProperty(
      'failure',
    );
    expectTypeOf<Extract<GatewayEngineState, { status: 'stopped' }>>().toHaveProperty('failure');
  });

  test('a failed start names a port and nothing a screen would have to interpret', () => {
    expectTypeOf<
      NonNullable<Extract<GatewayEngineState, { status: 'stopped' }>['failure']>
    >().toEqualTypeOf<{ port: number }>();
  });
});

describe('the protocol the two processes speak', () => {
  test('a directive is exactly a start or a stop', () => {
    expectTypeOf<EngineDirective['kind']>().toEqualTypeOf<'start' | 'stop'>();
  });

  test('the child hears only what serving needs, so no secret can reach it', () => {
    expectTypeOf<EngineGateway>().toEqualTypeOf<{
      slug: string;
      displayName: string;
      port: number;
    }>();
  });

  test('a report carries one gateway and the same state every surface reads', () => {
    expectTypeOf<EngineReport['state']>().toEqualTypeOf<GatewayEngineState>();
    expectTypeOf<EngineReport['kind']>().toEqualTypeOf<'state'>();
  });
});

describe('migration contracts', () => {
  test('a migration transforms one raw document shape into another', () => {
    expectTypeOf<Migration['from']>().toEqualTypeOf<number>();
    expectTypeOf<Migration['migrate']>().toEqualTypeOf<
      (doc: Record<string, unknown>) => Record<string, unknown>
    >();
  });
});
