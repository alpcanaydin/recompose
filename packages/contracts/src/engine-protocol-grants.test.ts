import { describe, expect, test } from 'vitest';

import {
  engineDirectiveSchema,
  engineReportSchema,
  engineSpendGrantSchema,
  engineSpendRequestSchema,
} from './engine-protocol';

const spendRequest = { kind: 'spend-request', id: 'g1', slug: 'personal', virtualModel: 'fast' };

const resolved = {
  kind: 'spend-grant',
  answers: 'g1',
  grant: {
    verdict: 'resolved',
    credential: 'sk-ant-api03-9f2c',
    providerOrigin: 'https://api.anthropic.com',
  },
};

describe('the ask a serving gateway sends the parent for one spend', () => {
  test('a spend request names the gateway and the virtual model the traffic arrived under', () => {
    expect(engineSpendRequestSchema.parse(spendRequest)).toEqual(spendRequest);
  });

  test('a spend request naming no gateway is refused, because two gateways may share a name', () => {
    const { slug, ...withoutTheGateway } = spendRequest;

    expect(slug).toBe('personal');
    expect(() => engineSpendRequestSchema.parse(withoutTheGateway)).toThrow();
  });

  test('a spend request naming no virtual model is refused, because it asks for nothing', () => {
    const { virtualModel, ...withoutTheModel } = spendRequest;

    expect(virtualModel).toBe('fast');
    expect(() => engineSpendRequestSchema.parse(withoutTheModel)).toThrow();
  });

  test('a spend request nobody can answer is refused, because the grant would reach no request', () => {
    const { id, ...withoutTheIdentifier } = spendRequest;

    expect(id).toBe('g1');
    expect(() => engineSpendRequestSchema.parse(withoutTheIdentifier)).toThrow();
  });

  test('a spend request carries no credential, because the answer is what brings one', () => {
    for (const smuggled of [{ credential: 'sk-ant-api03-9f2c' }, { key: 'sk-ant-api03-9f2c' }]) {
      expect(() => engineSpendRequestSchema.parse({ ...spendRequest, ...smuggled })).toThrow();
    }
  });

  test('a spend request whose virtual name breaks the slug grammar is refused', () => {
    expect(() =>
      engineSpendRequestSchema.parse({ ...spendRequest, virtualModel: 'Fast Model' }),
    ).toThrow();
  });
});

describe('the grant the parent answers a spend request with', () => {
  test('a resolved grant carries the credential and the origin it may be spent at', () => {
    expect(engineSpendGrantSchema.parse(resolved)).toEqual(resolved);
  });

  test('a resolved grant carrying a blank credential is refused, because it would spend nothing', () => {
    expect(() =>
      engineSpendGrantSchema.parse({
        ...resolved,
        grant: { ...resolved.grant, credential: '   ' },
      }),
    ).toThrow();
  });

  test('a resolved grant naming no origin is refused, because the spend would reach nowhere', () => {
    const { providerOrigin, ...withoutTheOrigin } = resolved.grant;

    expect(providerOrigin).toBe('https://api.anthropic.com');
    expect(() => engineSpendGrantSchema.parse({ ...resolved, grant: withoutTheOrigin })).toThrow();
  });

  test('a grant answering no request is refused, because the parent could not place it', () => {
    const { answers, ...withoutTheRequest } = resolved;

    expect(answers).toBe('g1');
    expect(() => engineSpendGrantSchema.parse(withoutTheRequest)).toThrow();
  });

  test('a grant answering a blank identifier is refused', () => {
    expect(() => engineSpendGrantSchema.parse({ ...resolved, answers: '   ' })).toThrow();
  });
});

describe('the refusal that stands where a credential would', () => {
  test('a refused grant names a missing target and carries nothing beside the state', () => {
    const refused = { ...resolved, grant: { verdict: 'missing-target' } };

    expect(engineSpendGrantSchema.parse(refused)).toEqual(refused);
  });

  test('a refused grant names a missing credential and carries nothing beside the state', () => {
    const refused = { ...resolved, grant: { verdict: 'missing-credential' } };

    expect(engineSpendGrantSchema.parse(refused)).toEqual(refused);
  });

  test('a refusal carries no message field, so it names a state rather than a sentence', () => {
    for (const verdict of ['missing-target', 'missing-credential']) {
      expect(() =>
        engineSpendGrantSchema.parse({
          ...resolved,
          grant: { verdict, message: 'the account left the registry' },
        }),
      ).toThrow();
    }
  });

  test('a refused grant carries no credential, because a refusal spends nothing', () => {
    expect(() =>
      engineSpendGrantSchema.parse({
        ...resolved,
        grant: { verdict: 'missing-target', credential: 'sk-ant-api03-9f2c' },
      }),
    ).toThrow();
  });

  test('a verdict outside the resolved grant and the two refusals is refused', () => {
    for (const verdict of ['refused', 'rate-limited', 'missing-model']) {
      expect(() => engineSpendGrantSchema.parse({ ...resolved, grant: { verdict } })).toThrow();
    }
  });
});

describe('the spend lane beside the shipped directive lane', () => {
  test('a spend request is no report, so the parent reads it on its own lane', () => {
    expect(() => engineReportSchema.parse(spendRequest)).toThrow();
  });

  test('a grant is no directive, so the child reads it on its own lane', () => {
    expect(() => engineDirectiveSchema.parse(resolved)).toThrow();
  });

  test('neither lane admits the other kind, so a mixed-up message answers nobody', () => {
    expect(() => engineSpendRequestSchema.parse({ kind: 'probe', id: 'g1' })).toThrow();
    expect(() => engineSpendGrantSchema.parse({ kind: 'key-check', answers: 'g1' })).toThrow();
  });
});
