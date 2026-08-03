import { describe, expectTypeOf, test } from 'vitest';

import type {
  AccountsDocument,
  IpcError,
  IpcRequest,
  IpcResponse,
  KeyCheckVerdict,
  LocalRuntimeId,
  RuntimeReachability,
} from './index';

describe('the channels that carry a local runtime', () => {
  test('connecting a runtime names the runtime alone, so no secret can reach the registry', () => {
    expectTypeOf<IpcRequest<'accounts:connect-local'>>().toEqualTypeOf<{
      runtime: LocalRuntimeId;
    }>();
    expectTypeOf<IpcRequest<'accounts:connect-local'>>().not.toHaveProperty('secret');
    expectTypeOf<IpcRequest<'accounts:connect-local'>>().not.toHaveProperty('key');
    expectTypeOf<IpcRequest<'accounts:connect-local'>>().not.toHaveProperty('credentialRef');
  });

  test('the renderer never supplies an address, because main mints it from the table', () => {
    expectTypeOf<IpcRequest<'accounts:connect-local'>>().not.toHaveProperty('address');
    expectTypeOf<IpcRequest<'accounts:detect-runtime'>>().not.toHaveProperty('address');
  });

  test('connecting a runtime answers what connecting an account answers', () => {
    expectTypeOf<IpcResponse<'accounts:connect-local'>>().toEqualTypeOf<
      { ok: true; value: AccountsDocument } | { ok: false; error: IpcError }
    >();
  });

  test('detecting names a runtime and checking names a stored row', () => {
    expectTypeOf<IpcRequest<'accounts:detect-runtime'>>().toEqualTypeOf<{
      runtime: LocalRuntimeId;
    }>();
    expectTypeOf<IpcRequest<'accounts:check-runtime'>>().toEqualTypeOf<{ id: string }>();
  });

  test('both looks answer one reading of the machine, in its own vocabulary', () => {
    expectTypeOf<IpcResponse<'accounts:detect-runtime'>>().toEqualTypeOf<
      { ok: true; value: RuntimeReachability } | { ok: false; error: IpcError }
    >();
    expectTypeOf<IpcResponse<'accounts:check-runtime'>>().toEqualTypeOf<
      IpcResponse<'accounts:detect-runtime'>
    >();
    expectTypeOf<Extract<RuntimeReachability['verdict'], KeyCheckVerdict>>().toEqualTypeOf<never>();
  });
});
