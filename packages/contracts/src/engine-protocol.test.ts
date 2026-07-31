import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { engineDirectiveSchema, engineGatewaySchema, engineReportSchema } from './engine-protocol';

const gateway = { slug: 'personal', displayName: 'Personal', port: 8397 };

describe('the gateway the parent hands the child', () => {
  test('a gateway carries the slug, the name, and the port and nothing else', () => {
    expect(engineGatewaySchema.parse(gateway)).toEqual(gateway);
  });

  test('a gateway carries no virtual model, because the engine serves none yet', () => {
    expect(() => engineGatewaySchema.parse({ ...gateway, virtualModels: [] })).toThrow();
  });

  test('a gateway carries no routing, so no secret can ride to the child', () => {
    expect(() => engineGatewaySchema.parse({ ...gateway, accountId: 'acc-1' })).toThrow();
  });

  test('a nameless gateway is refused, because the health answer names it', () => {
    expect(() => engineGatewaySchema.parse({ ...gateway, displayName: '   ' })).toThrow();
  });
});

describe('a directive the parent sends the child', () => {
  test('a start directive carries the whole gateway the child must serve', () => {
    const start = { kind: 'start', id: 'd1', gateway };

    expect(engineDirectiveSchema.parse(start)).toEqual(start);
  });

  test('a stop directive names one gateway and nothing more', () => {
    const stop = { kind: 'stop', id: 'd1', slug: 'personal' };

    expect(engineDirectiveSchema.parse(stop)).toEqual(stop);
  });

  test('a stop directive cannot carry a gateway it has no business restating', () => {
    expect(() =>
      engineDirectiveSchema.parse({ kind: 'stop', id: 'd1', slug: 'personal', gateway }),
    ).toThrow();
  });

  test('a directive the child does not know is refused', () => {
    for (const kind of ['restart', 'shutdown', 'state']) {
      expect(() => engineDirectiveSchema.parse({ kind, id: 'd1', slug: 'personal' })).toThrow();
    }
  });

  test('a directive carrying no identifier is refused, because its report would answer nobody', () => {
    expect(() => engineDirectiveSchema.parse({ kind: 'start', gateway })).toThrow();
    expect(() => engineDirectiveSchema.parse({ kind: 'stop', slug: 'personal' })).toThrow();
  });

  test('a directive carrying a blank identifier is refused', () => {
    expect(() =>
      engineDirectiveSchema.parse({ kind: 'stop', id: '   ', slug: 'personal' }),
    ).toThrow();
  });
});

describe('a report the child sends the parent', () => {
  test('a report carries the state of exactly one gateway', () => {
    const report = {
      kind: 'state',
      answers: 'd1',
      slug: 'personal',
      state: { status: 'running' },
    };

    expect(engineReportSchema.parse(report)).toEqual(report);
  });

  test('a report carries a failed start inside the state it reports', () => {
    const report = {
      kind: 'state',
      answers: 'd1',
      slug: 'personal',
      state: { status: 'stopped', failure: { port: 8397 } },
    };

    expect(engineReportSchema.parse(report)).toEqual(report);
  });

  test('a report the parent does not know is refused', () => {
    for (const kind of ['start', 'stop', 'log']) {
      expect(() =>
        engineReportSchema.parse({
          kind,
          answers: 'd1',
          slug: 'personal',
          state: { status: 'running' },
        }),
      ).toThrow();
    }
  });

  test('a report about no gateway in particular is refused', () => {
    expect(() =>
      engineReportSchema.parse({ kind: 'state', answers: 'd1', state: { status: 'running' } }),
    ).toThrow();
  });

  test('a report naming no directive is refused, because the parent could not place it', () => {
    expect(() =>
      engineReportSchema.parse({ kind: 'state', slug: 'personal', state: { status: 'running' } }),
    ).toThrow();
  });
});

const slugArb = fc
  .array(fc.stringMatching(/^[a-z0-9]{1,6}$/), { minLength: 2, maxLength: 3 })
  .map((segments) => segments.join('-'));

const trimmedDisplayNameArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const directiveIdArb = fc.stringMatching(/^[a-z0-9-]{1,12}$/);

const directiveArb = fc.oneof(
  fc.record({
    kind: fc.constant('start' as const),
    id: directiveIdArb,
    gateway: fc.record({
      slug: slugArb,
      displayName: trimmedDisplayNameArb,
      port: fc.integer({ min: 1024, max: 65535 }),
    }),
  }),
  fc.record({ kind: fc.constant('stop' as const), id: directiveIdArb, slug: slugArb }),
);

describe('the wire between the two processes', () => {
  test.prop([directiveArb])('any directive survives the crossing unchanged', (directive) => {
    const crossed: unknown = structuredClone(directive);

    expect(engineDirectiveSchema.parse(crossed)).toEqual(directive);
  });
});
