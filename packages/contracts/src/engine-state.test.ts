import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { engineStatesSchema, gatewayEngineStateSchema } from './engine-state';

describe('the state of one gateway', () => {
  test('a serving gateway carries nothing beyond the fact that it serves', () => {
    expect(gatewayEngineStateSchema.parse({ status: 'running' })).toEqual({ status: 'running' });
  });

  test('a gateway nobody started carries no failure', () => {
    expect(gatewayEngineStateSchema.parse({ status: 'stopped' })).toEqual({ status: 'stopped' });
  });

  test('a gateway whose start lost the port carries the port it wanted', () => {
    const failedStart = { status: 'stopped', failure: { port: 8397 } };

    expect(gatewayEngineStateSchema.parse(failedStart)).toEqual(failedStart);
  });

  test('a serving gateway cannot carry a failure, because serving is not failing', () => {
    expect(() =>
      gatewayEngineStateSchema.parse({ status: 'running', failure: { port: 8397 } }),
    ).toThrow();
  });

  test('a status the app never reports is refused', () => {
    for (const status of ['starting', 'stopping', 'failed', 'unknown']) {
      expect(() => gatewayEngineStateSchema.parse({ status })).toThrow();
    }
  });

  test('a failure naming a port outside the gateway range is refused', () => {
    for (const port of [0, 80, 65536]) {
      expect(() =>
        gatewayEngineStateSchema.parse({ status: 'stopped', failure: { port } }),
      ).toThrow();
    }
  });

  test('a failure cannot smuggle a reason the screen would have to interpret', () => {
    expect(() =>
      gatewayEngineStateSchema.parse({
        status: 'stopped',
        failure: { port: 8397, message: 'boom' },
      }),
    ).toThrow();
  });
});

describe('the snapshot every surface reads', () => {
  test('a snapshot maps each gateway to its own state', () => {
    const snapshot = {
      personal: { status: 'running' },
      work: { status: 'stopped', failure: { port: 8398 } },
    };

    expect(engineStatesSchema.parse(snapshot)).toEqual(snapshot);
  });

  test('an empty snapshot parses, because no gateway is a state of the world', () => {
    expect(engineStatesSchema.parse({})).toEqual({});
  });

  test('a snapshot keyed by something no gateway could be named is refused', () => {
    for (const slug of ['UPPER', 'has space', 'trail-', 'con']) {
      expect(() => engineStatesSchema.parse({ [slug]: { status: 'running' } })).toThrow();
    }
  });
});

const gatewayEngineStateArb = fc.oneof(
  fc.constant({ status: 'running' as const }),
  fc.constant({ status: 'stopped' as const }),
  fc
    .integer({ min: 1024, max: 65535 })
    .map((port) => ({ status: 'stopped' as const, failure: { port } })),
);

const snapshotArb = fc.dictionary(
  fc
    .array(fc.stringMatching(/^[a-z0-9]{1,6}$/), { minLength: 2, maxLength: 3 })
    .map((segments) => segments.join('-')),
  gatewayEngineStateArb,
);

describe('a snapshot crossing the process boundary', () => {
  test.prop([snapshotArb])('any snapshot survives the crossing identically', (snapshot) => {
    const crossed: unknown = structuredClone(snapshot);

    expect(engineStatesSchema.parse(crossed)).toEqual(snapshot);
  });
});
