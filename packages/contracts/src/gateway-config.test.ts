import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { GATEWAY_CONFIG_VERSION, gatewayConfigSchema, loadGatewayConfig } from './gateway-config';

const validTarget = {
  kind: 'target' as const,
  id: 't1',
  accountId: 'acc-claude-max',
  providerModel: 'claude-sonnet-5',
  weight: 100,
};

const validConfig = {
  schemaVersion: GATEWAY_CONFIG_VERSION,
  slug: 'my-gateway',
  displayName: 'My Gateway',
  virtualModels: [
    {
      id: 'vm1',
      slug: 'fast',
      displayName: 'fast',
      routing: {
        kind: 'router' as const,
        id: 'r1',
        mode: 'failover' as const,
        children: [validTarget, { ...validTarget, id: 't2', weight: 0 }],
      },
    },
  ],
  layout: {
    nodes: { gateway: { x: 0, y: 0 }, vm1: { x: 240, y: 0 } },
  },
};

describe('gateway config schema: valid shapes', () => {
  test('a canonical config parses and keeps its shape', () => {
    const parsed = gatewayConfigSchema.parse(validConfig);

    expect(parsed).toEqual(validConfig);
  });

  test('a virtual model may route straight to a single target', () => {
    const direct = {
      ...validConfig,
      virtualModels: [{ id: 'vm1', slug: 'code', displayName: 'code', routing: validTarget }],
    };

    expect(gatewayConfigSchema.parse(direct).virtualModels[0]?.routing.kind).toBe('target');
  });
});

describe('gateway config schema: routing tree', () => {
  test('routers chain: a router child may itself be a router', () => {
    const nested = {
      ...validConfig,
      virtualModels: [
        {
          id: 'vm1',
          slug: 'fast',
          displayName: 'fast',
          routing: {
            kind: 'router' as const,
            id: 'outer',
            mode: 'round-robin' as const,
            children: [
              validTarget,
              {
                kind: 'router' as const,
                id: 'inner',
                mode: 'failover' as const,
                children: [{ ...validTarget, id: 't3' }],
              },
            ],
          },
        },
      ],
    };

    expect(() => gatewayConfigSchema.parse(nested)).not.toThrow();
  });

  test('a router needs at least one child', () => {
    const empty = {
      ...validConfig,
      virtualModels: [
        {
          id: 'vm1',
          slug: 'fast',
          displayName: 'fast',
          routing: { kind: 'router' as const, id: 'r1', mode: 'failover' as const, children: [] },
        },
      ],
    };

    expect(() => gatewayConfigSchema.parse(empty)).toThrow();
  });
});

describe('gateway config schema: rejections', () => {
  test('secrets cannot hide in a config: unknown keys are rejected', () => {
    expect(() => gatewayConfigSchema.parse({ ...validConfig, apiKey: 'sk-oops' })).toThrow();
  });

  test('secrets cannot hide in a nested router child either', () => {
    const nestedSmuggle = {
      ...validConfig,
      virtualModels: [
        {
          id: 'vm1',
          slug: 'fast',
          displayName: 'fast',
          routing: {
            kind: 'router' as const,
            id: 'outer',
            mode: 'failover' as const,
            children: [
              {
                kind: 'router' as const,
                id: 'inner',
                mode: 'failover' as const,
                children: [{ ...validTarget, apiKey: 'sk-oops' }],
              },
            ],
          },
        },
      ],
    };

    expect(() => gatewayConfigSchema.parse(nestedSmuggle)).toThrow();
  });

  test('invalid slugs are rejected', () => {
    for (const bad of ['My Gateway', 'UPPER', '-lead', 'trail-', 'a--b', '']) {
      expect(() => gatewayConfigSchema.parse({ ...validConfig, slug: bad })).toThrow();
    }
  });
});

describe('gateway config schema: migration', () => {
  test('loadGatewayConfig validates after migration', () => {
    expect(loadGatewayConfig(validConfig)).toEqual(validConfig);
    expect(() => loadGatewayConfig({ schemaVersion: 99 })).toThrow(/newer/);
    expect(() => loadGatewayConfig({ schemaVersion: 1, slug: 'x!' })).toThrow();
  });
});

const slugSegmentArb = fc.stringMatching(/^[a-z0-9]{1,6}$/);
const slugArb = fc
  .array(slugSegmentArb, { minLength: 1, maxLength: 4 })
  .map((segments) => segments.join('-'));

const targetArb = fc.record({
  kind: fc.constant('target' as const),
  id: fc.uuid(),
  accountId: slugArb,
  providerModel: fc.stringMatching(/^[a-z0-9][a-z0-9.-]{0,40}$/),
  weight: fc.integer({ min: 0, max: 100 }),
});

const routingArb = fc.letrec((tie) => ({
  node: fc.oneof(
    { maxDepth: 3, withCrossShrink: true },
    targetArb,
    fc.record({
      kind: fc.constant('router' as const),
      id: fc.uuid(),
      mode: fc.constantFrom('failover' as const, 'round-robin' as const),
      children: fc.array(tie('node'), { minLength: 1, maxLength: 3 }),
    }),
  ),
})).node;

const trimmedDisplayNameArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const configArb = fc.record({
  schemaVersion: fc.constant(GATEWAY_CONFIG_VERSION),
  slug: slugArb,
  displayName: trimmedDisplayNameArb,
  virtualModels: fc.array(
    fc.record({
      id: fc.uuid(),
      slug: slugArb,
      displayName: trimmedDisplayNameArb,
      routing: routingArb,
    }),
    { minLength: 1, maxLength: 4 },
  ),
  layout: fc.record({
    nodes: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.record({
        x: fc.integer({ min: -10000, max: 10000 }),
        y: fc.integer({ min: -10000, max: 10000 }),
      }),
    ),
  }),
});

describe('gateway config round-trip', () => {
  test.prop([configArb])('any valid config survives serialize → parse identically', (config) => {
    const serialized = JSON.stringify(config);
    const deserialized: unknown = JSON.parse(serialized);
    const roundTripped = loadGatewayConfig(deserialized);

    expect(roundTripped).toEqual(config);
  });
});
