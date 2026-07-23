import { describe, expectTypeOf, test } from 'vitest';

import type {
  AccountsDocument,
  GatewayConfig,
  IpcChannel,
  IpcError,
  IpcRequest,
  IpcResponse,
  Migration,
  RecomposeIpc,
  Settings,
} from './index';

describe('ipc request contracts', () => {
  test('read channels take no payload', () => {
    expectTypeOf<IpcRequest<'gateways:list'>>().toEqualTypeOf<void>();
    expectTypeOf<IpcRequest<'settings:get'>>().toEqualTypeOf<void>();
    expectTypeOf<IpcRequest<'accounts:list'>>().toEqualTypeOf<void>();
  });

  test('write channels take exactly their domain payload', () => {
    expectTypeOf<IpcRequest<'gateways:save'>>().toEqualTypeOf<GatewayConfig>();
    expectTypeOf<IpcRequest<'settings:save'>>().toEqualTypeOf<Settings>();
    expectTypeOf<IpcRequest<'accounts:remove'>>().toEqualTypeOf<{ id: string }>();
  });

  test('connecting an account is the only channel that carries a secret inbound', () => {
    expectTypeOf<IpcRequest<'accounts:connect'>>().toHaveProperty('secret');
    expectTypeOf<IpcRequest<'accounts:connect'>['secret']>().toEqualTypeOf<string>();
    expectTypeOf<IpcRequest<'gateways:save'>>().not.toHaveProperty('secret');
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
      'vault-unavailable' | 'vault-newer-schema' | 'validation-failed' | 'storage-failed'
    >();
  });

  test('account rows crossing the bridge are structurally secret-free', () => {
    expectTypeOf<AccountsDocument['accounts'][number]>().not.toHaveProperty('secret');
    expectTypeOf<AccountsDocument['accounts'][number]>().toHaveProperty('credentialRef');
  });
});

describe('bridge surface totality', () => {
  test('the bridge type covers every contract channel and nothing else', () => {
    expectTypeOf<keyof RecomposeIpc>().toEqualTypeOf<IpcChannel>();
  });

  test('each bridge entry maps its channel request to a promised response', () => {
    expectTypeOf<RecomposeIpc['accounts:connect']>().toEqualTypeOf<
      (request: IpcRequest<'accounts:connect'>) => Promise<IpcResponse<'accounts:connect'>>
    >();
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
