import { describe, expectTypeOf, test } from 'vitest';

import type { GatewayConfig, Target, VirtualModel } from './index';

import { modelAliasSchema } from './gateway-config';

describe('the stored shape of a virtual model', () => {
  test('the config pins itself to schema version 2', () => {
    expectTypeOf<GatewayConfig['schemaVersion']>().toEqualTypeOf<2>();
  });

  test('a gateway holds a list of virtual models', () => {
    expectTypeOf<GatewayConfig['virtualModels']>().toEqualTypeOf<VirtualModel[]>();
  });

  test('a virtual model carries a name, a display name, and one target', () => {
    expectTypeOf<keyof VirtualModel>().toEqualTypeOf<'id' | 'displayName' | 'target'>();
    expectTypeOf<VirtualModel['id']>().toEqualTypeOf<string>();
    expectTypeOf<VirtualModel['displayName']>().toEqualTypeOf<string>();
  });

  test('the id a client sends parses to a plain string', () => {
    expectTypeOf(modelAliasSchema.parse('claude-5.6-sol')).toEqualTypeOf<string>();
  });

  test('the target is one binding, never a list and never optional', () => {
    expectTypeOf<VirtualModel['target']>().toEqualTypeOf<Target>();
    expectTypeOf<VirtualModel['target']>().not.toEqualTypeOf<Target | undefined>();
  });

  test('a virtual model structurally cannot hold a routing ladder', () => {
    expectTypeOf<VirtualModel>().not.toHaveProperty('routing');
    expectTypeOf<VirtualModel>().not.toHaveProperty('slug');
  });
});

describe('the stored shape of a target', () => {
  test('a target names the account it spends and the real model it asks for', () => {
    expectTypeOf<keyof Target>().toEqualTypeOf<'accountId' | 'providerModel'>();
    expectTypeOf<Target['accountId']>().toEqualTypeOf<string>();
    expectTypeOf<Target['providerModel']>().toEqualTypeOf<string>();
  });

  test('a target carries no weight, because one target needs no share', () => {
    expectTypeOf<Target>().not.toHaveProperty('weight');
  });

  test('a target structurally cannot hold a secret or an account kind', () => {
    expectTypeOf<Target>().not.toHaveProperty('kind');
    expectTypeOf<Target>().not.toHaveProperty('credentialRef');
    expectTypeOf<Target>().not.toHaveProperty('key');
  });
});
