import { describe, expectTypeOf, test } from 'vitest';

import type {
  EngineDirective,
  EngineGateway,
  EngineReport,
  GatewayEngineState,
  KeyCheckVerdict,
  KeyProviderId,
} from './index';

type ProbeDirective = Extract<EngineDirective, { kind: 'probe' }>;

type KeyCheckReportArm = Extract<EngineReport, { kind: 'key-check' }>;

describe('the protocol the two processes speak', () => {
  test('a directive is a start, a stop, or a probe', () => {
    expectTypeOf<EngineDirective['kind']>().toEqualTypeOf<'start' | 'stop' | 'probe'>();
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
});

describe('the report the child sends home', () => {
  test('a report is a gateway state or a key check, told apart by its kind', () => {
    expectTypeOf<EngineReport['kind']>().toEqualTypeOf<'state' | 'key-check'>();
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
});
