import { describe, expect, test } from 'vitest';

import { GATEWAY_CONFIG_VERSION, gatewayConfigSchema } from './gateway-config';

function bindingOn(id: string, accountId: string): Record<string, unknown> {
  return { id, displayName: 'Bound', target: { accountId, providerModel: 'a-real-model' } };
}

function configHolding(virtualModels: readonly Record<string, unknown>[]): Record<string, unknown> {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug: 'my-gateway',
    displayName: 'My Gateway',
    port: 8397,
    virtualModels,
    layout: { nodes: { gateway: { x: 0, y: 0 } } },
  };
}

describe('an account a virtual model may stand on', () => {
  test('a key account stands as a target', () => {
    const parsed = gatewayConfigSchema.parse(
      configHolding([bindingOn('fast', 'acc-anthropic-key')]),
    );

    expect(parsed.virtualModels[0]?.target.accountId).toBe('acc-anthropic-key');
  });

  test('an aggregator account stands as a target', () => {
    const parsed = gatewayConfigSchema.parse(configHolding([bindingOn('fast', 'acc-openrouter')]));

    expect(parsed.virtualModels[0]?.target.accountId).toBe('acc-openrouter');
  });

  test('a local runtime stands as a target', () => {
    const parsed = gatewayConfigSchema.parse(configHolding([bindingOn('fast', 'acc-ollama')]));

    expect(parsed.virtualModels[0]?.target.accountId).toBe('acc-ollama');
  });
});

describe('a subscription account standing as a target', () => {
  test('a config binds a virtual model to a subscription account', () => {
    const parsed = gatewayConfigSchema.parse(configHolding([bindingOn('fast', 'acc-claude-max')]));

    expect(parsed.virtualModels[0]?.target.accountId).toBe('acc-claude-max');
  });

  test('a subscription can stand beside targets held under other account kinds', () => {
    const parsed = gatewayConfigSchema.parse(
      configHolding([bindingOn('fast', 'acc-openrouter'), bindingOn('deep', 'acc-claude-max')]),
    );

    expect(parsed.virtualModels.map((model) => model.target.accountId)).toEqual([
      'acc-openrouter',
      'acc-claude-max',
    ]);
  });
});

describe('a target the registry can no longer resolve', () => {
  test('a binding onto an account that left the registry still stores', () => {
    const parsed = gatewayConfigSchema.parse(configHolding([bindingOn('fast', 'acc-removed')]));

    expect(parsed.virtualModels[0]?.target.accountId).toBe('acc-removed');
  });

  test('a gateway holding no virtual model stores against an empty registry', () => {
    expect(gatewayConfigSchema.parse(configHolding([])).virtualModels).toEqual([]);
  });
});
