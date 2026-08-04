import { describe, expectTypeOf, test } from 'vitest';

import type {
  EngineDirective,
  EngineGateway,
  EngineReport,
  GatewayEngineState,
  KeyCheckVerdict,
  KeyProviderId,
  RuntimeReachability,
} from './index';

type ProbeDirective = Extract<EngineDirective, { kind: 'probe' }>;

type RuntimeProbeDirective = Extract<EngineDirective, { kind: 'probe-runtime' }>;

type KeyCheckReportArm = Extract<EngineReport, { kind: 'key-check' }>;

type RuntimeCheckReportArm = Extract<EngineReport, { kind: 'runtime-check' }>;

describe('the protocol the two processes speak', () => {
  test('a directive is a start, a stop, or one of the two probes', () => {
    expectTypeOf<EngineDirective['kind']>().toEqualTypeOf<
      'start' | 'stop' | 'probe' | 'probe-runtime'
    >();
  });

  test('the child hears only what serving needs, so no secret rides a gateway', () => {
    expectTypeOf<EngineGateway>().toEqualTypeOf<{
      slug: string;
      displayName: string;
      port: number;
    }>();
  });

  test('the probe is the one directive a key can travel in', () => {
    expectTypeOf<ProbeDirective['key']>().toEqualTypeOf<string>();
    expectTypeOf<Extract<EngineDirective, { kind: 'start' }>>().not.toHaveProperty('key');
    expectTypeOf<Extract<EngineDirective, { kind: 'stop' }>>().not.toHaveProperty('key');
  });

  test('a probe names one of the providers a dialect covers', () => {
    expectTypeOf<ProbeDirective['provider']>().toEqualTypeOf<KeyProviderId>();
  });

  test('a runtime probe carries the address it looks at, the id it answers, and nothing else', () => {
    expectTypeOf<keyof RuntimeProbeDirective>().toEqualTypeOf<'kind' | 'id' | 'address'>();
    expectTypeOf<RuntimeProbeDirective['address']>().toEqualTypeOf<string>();
  });

  test('a runtime probe carries no credential and names no vendor', () => {
    expectTypeOf<RuntimeProbeDirective>().not.toHaveProperty('key');
    expectTypeOf<RuntimeProbeDirective>().not.toHaveProperty('secret');
    expectTypeOf<RuntimeProbeDirective>().not.toHaveProperty('provider');
  });
});

describe('the report the child sends home', () => {
  test('a report is a gateway state, a key check, or a runtime check, told apart by its kind', () => {
    expectTypeOf<EngineReport['kind']>().toEqualTypeOf<'state' | 'key-check' | 'runtime-check'>();
  });

  test('a state report carries one gateway and the same state every surface reads', () => {
    expectTypeOf<
      Extract<EngineReport, { kind: 'state' }>['state']
    >().toEqualTypeOf<GatewayEngineState>();
  });

  test('a key check carries the verdict, the status, and the directive it answers, and nothing else', () => {
    expectTypeOf<keyof KeyCheckReportArm>().toEqualTypeOf<
      'kind' | 'answers' | 'verdict' | 'status'
    >();
    expectTypeOf<KeyCheckReportArm['verdict']>().toEqualTypeOf<KeyCheckVerdict>();
    expectTypeOf<KeyCheckReportArm['status']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<KeyCheckReportArm['answers']>().toEqualTypeOf<string>();
  });

  test('a key check carries no gateway and no field a vendor body could fill', () => {
    expectTypeOf<KeyCheckReportArm>().not.toHaveProperty('slug');
    expectTypeOf<KeyCheckReportArm>().not.toHaveProperty('state');
    expectTypeOf<KeyCheckReportArm>().not.toHaveProperty('body');
    expectTypeOf<KeyCheckReportArm>().not.toHaveProperty('key');
  });

  test('a runtime check carries the reading and the directive it answers, and nothing else', () => {
    expectTypeOf<keyof RuntimeCheckReportArm>().toEqualTypeOf<
      'kind' | 'answers' | 'reachability'
    >();
    expectTypeOf<RuntimeCheckReportArm['reachability']>().toEqualTypeOf<RuntimeReachability>();
    expectTypeOf<RuntimeCheckReportArm['answers']>().toEqualTypeOf<string>();
  });

  test('a runtime check speaks its own verdicts rather than the key-check triad', () => {
    expectTypeOf<RuntimeCheckReportArm['reachability']['verdict']>().toEqualTypeOf<
      'answers' | 'unrecognized' | 'unreachable'
    >();
    expectTypeOf<
      Extract<RuntimeCheckReportArm['reachability']['verdict'], KeyCheckVerdict>
    >().toEqualTypeOf<never>();
  });

  test('a runtime check carries no gateway, no address, and no body it read', () => {
    expectTypeOf<RuntimeCheckReportArm>().not.toHaveProperty('slug');
    expectTypeOf<RuntimeCheckReportArm>().not.toHaveProperty('address');
    expectTypeOf<RuntimeCheckReportArm>().not.toHaveProperty('body');
    expectTypeOf<RuntimeCheckReportArm>().not.toHaveProperty('verdict');
  });
});
