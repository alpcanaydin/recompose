import { describe, expectTypeOf, test } from 'vitest';

import type {
  EngineDirective,
  EngineGateway,
  EngineReport,
  EngineSpendGrant,
  EngineSpendRequest,
  EngineVirtualModel,
  GatewayEngineState,
  KeyCheckVerdict,
  KeyProviderId,
  RuntimeReachability,
  SpendGrant,
} from './index';

type ProbeDirective = Extract<EngineDirective, { kind: 'probe' }>;

type BoundTarget = Extract<EngineVirtualModel['target'], { standing: 'bound' }>;

type RemovedTarget = Extract<EngineVirtualModel['target'], { standing: 'removed' }>;

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

type RefusedGrant = Exclude<SpendGrant, { verdict: 'resolved' }>;

type GrantedSpend = ResolvedGrant['spend'];

type CredentialedSpend = Extract<GrantedSpend, { custody: 'credentialed' }>;

type OpenSpend = Extract<GrantedSpend, { custody: 'open' }>;

type SubscriptionSpend = Extract<GrantedSpend, { custody: 'subscription' }>;

type RuntimeProbeDirective = Extract<EngineDirective, { kind: 'probe-runtime' }>;

type KeyCheckReportArm = Extract<EngineReport, { kind: 'key-check' }>;

type RuntimeCheckReportArm = Extract<EngineReport, { kind: 'runtime-check' }>;

describe('the protocol the two processes speak', () => {
  test('a directive is a start, a stop, one of the two probes, or a model-list look', () => {
    expectTypeOf<EngineDirective['kind']>().toEqualTypeOf<
      'start' | 'stop' | 'probe' | 'probe-runtime' | 'list-models'
    >();
  });

  test('the child hears only what serving needs, so no secret rides a gateway', () => {
    expectTypeOf<EngineGateway>().toEqualTypeOf<{
      slug: string;
      displayName: string;
      port: number;
      virtualModels: EngineVirtualModel[];
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
  test('a report is a gateway state, a check, or a model list, told apart by its kind', () => {
    expectTypeOf<EngineReport['kind']>().toEqualTypeOf<
      'state' | 'key-check' | 'runtime-check' | 'model-list'
    >();
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

describe('the binding snapshot the child serves a listing from', () => {
  test('a binding carries the id, the name, and the target standing, and nothing else', () => {
    expectTypeOf<keyof EngineVirtualModel>().toEqualTypeOf<'id' | 'displayName' | 'target'>();
    expectTypeOf<EngineVirtualModel['id']>().toEqualTypeOf<string>();
    expectTypeOf<EngineVirtualModel['displayName']>().toEqualTypeOf<string>();
  });

  test('a binding carries no credential under any name', () => {
    expectTypeOf<EngineVirtualModel>().not.toHaveProperty('credential');
    expectTypeOf<EngineVirtualModel>().not.toHaveProperty('key');
    expectTypeOf<EngineVirtualModel>().not.toHaveProperty('accountId');
  });

  test('a target either stands bound to a real model or stands removed', () => {
    expectTypeOf<EngineVirtualModel['target']['standing']>().toEqualTypeOf<'bound' | 'removed'>();
    expectTypeOf<keyof BoundTarget>().toEqualTypeOf<'standing' | 'providerModel'>();
    expectTypeOf<BoundTarget['providerModel']>().toEqualTypeOf<string>();
    expectTypeOf<keyof RemovedTarget>().toEqualTypeOf<'standing'>();
  });
});

describe('the grant lane one spend rides', () => {
  test('a spend request keys itself by the gateway and the virtual model, and answers to an id', () => {
    expectTypeOf<keyof EngineSpendRequest>().toEqualTypeOf<
      'kind' | 'id' | 'slug' | 'virtualModel'
    >();
    expectTypeOf<EngineSpendRequest['kind']>().toEqualTypeOf<'spend-request'>();
  });

  test('a spend request carries no credential, because it is the ask for one', () => {
    expectTypeOf<EngineSpendRequest>().not.toHaveProperty('credential');
    expectTypeOf<EngineSpendRequest>().not.toHaveProperty('key');
  });

  test('a grant is resolved, a missing target, or a missing credential', () => {
    expectTypeOf<SpendGrant['verdict']>().toEqualTypeOf<
      'resolved' | 'missing-target' | 'missing-credential'
    >();
  });

  test('a resolved grant carries the origin and the spend it authorizes, and nothing else', () => {
    expectTypeOf<keyof ResolvedGrant>().toEqualTypeOf<'verdict' | 'providerOrigin' | 'spend'>();
    expectTypeOf<ResolvedGrant['providerOrigin']>().toEqualTypeOf<string>();
    expectTypeOf<ResolvedGrant>().not.toHaveProperty('credential');
  });

  test('a refusal names its state and carries no sentence and no credential', () => {
    expectTypeOf<keyof RefusedGrant>().toEqualTypeOf<'verdict'>();
    expectTypeOf<RefusedGrant['verdict']>().toEqualTypeOf<
      'missing-target' | 'missing-credential'
    >();
    expectTypeOf<RefusedGrant>().not.toHaveProperty('message');
    expectTypeOf<RefusedGrant>().not.toHaveProperty('credential');
  });

  test('a grant answers the spend request that asked and carries one grant', () => {
    expectTypeOf<keyof EngineSpendGrant>().toEqualTypeOf<'kind' | 'answers' | 'grant'>();
    expectTypeOf<EngineSpendGrant['kind']>().toEqualTypeOf<'spend-grant'>();
    expectTypeOf<EngineSpendGrant['answers']>().toEqualTypeOf<string>();
    expectTypeOf<EngineSpendGrant['grant']>().toEqualTypeOf<SpendGrant>();
  });
});

describe('the spend a resolved grant authorizes', () => {
  test('a spend names credentialed, open, or subscription custody', () => {
    expectTypeOf<GrantedSpend['custody']>().toEqualTypeOf<
      'credentialed' | 'open' | 'subscription'
    >();
  });

  test('a credentialed spend carries the credential, and nothing else', () => {
    expectTypeOf<keyof CredentialedSpend>().toEqualTypeOf<'custody' | 'credential'>();
    expectTypeOf<CredentialedSpend['credential']>().toEqualTypeOf<string>();
  });

  test('an open spend admits no credential key at all, rather than an absent one', () => {
    expectTypeOf<OpenSpend>().toEqualTypeOf<{ custody: 'open' }>();
    expectTypeOf<keyof OpenSpend>().toEqualTypeOf<'custody'>();
    expectTypeOf<OpenSpend>().not.toHaveProperty('credential');
  });

  test('a subscription spend carries the provider account and whole credential document', () => {
    expectTypeOf<keyof SubscriptionSpend>().toEqualTypeOf<
      'custody' | 'provider' | 'accountId' | 'credential'
    >();
  });

  test('a refusal authorizes no spend', () => {
    expectTypeOf<RefusedGrant>().not.toHaveProperty('spend');
  });
});
