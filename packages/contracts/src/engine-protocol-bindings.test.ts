import { describe, expect, test } from 'vitest';

import { engineGatewaySchema } from './engine-protocol';

const binding = {
  id: 'fast',
  displayName: 'Fast',
  target: { standing: 'bound', providerModel: 'claude-sonnet-4-5' },
};

const gateway = {
  slug: 'personal',
  displayName: 'Personal',
  port: 8397,
  virtualModels: [binding],
};

function aGatewayBindingLike(patch: Record<string, unknown>): unknown {
  return { ...gateway, virtualModels: [{ ...binding, ...patch }] };
}

describe('the binding snapshot the child answers listings from', () => {
  test('a binding names the virtual model, the name a listing prints, and the model it stands on', () => {
    expect(engineGatewaySchema.parse(gateway).virtualModels).toEqual([binding]);
  });

  test('a gateway carries every model it was handed, so a listing names them all', () => {
    const second = { ...binding, id: 'deep', displayName: 'Deep' };

    expect(
      engineGatewaySchema.parse({ ...gateway, virtualModels: [binding, second] }).virtualModels,
    ).toEqual([binding, second]);
  });

  test('a binding whose target left the registry stands removed', () => {
    const removed = aGatewayBindingLike({ target: { standing: 'removed' } });

    expect(engineGatewaySchema.parse(removed)).toEqual(removed);
  });
});

describe('the standing that tells a bound target from a removed one', () => {
  test('a removed target names no model, because nothing stands behind the name', () => {
    const removedWithAModel = aGatewayBindingLike({
      target: { standing: 'removed', providerModel: 'claude-sonnet-4-5' },
    });

    expect(() => engineGatewaySchema.parse(removedWithAModel)).toThrow();
  });

  test('a standing the child cannot tell bound from removed by is refused', () => {
    for (const standing of ['unknown', 'missing-target', '']) {
      const guessed = aGatewayBindingLike({ target: { standing } });

      expect(() => engineGatewaySchema.parse(guessed)).toThrow();
    }
  });

  test('a bound target naming no model is refused, because the request would carry no name', () => {
    const nameless = aGatewayBindingLike({ target: { standing: 'bound', providerModel: '   ' } });

    expect(() => engineGatewaySchema.parse(nameless)).toThrow();
  });
});

describe('what a binding refuses to carry', () => {
  test('a binding carries no credential, so the snapshot holds no secret', () => {
    for (const smuggled of [
      { credential: 'sk-ant-api03-9f2c' },
      { key: 'sk-ant-api03-9f2c' },
      { accountId: 'acc-1' },
    ]) {
      expect(() => engineGatewaySchema.parse(aGatewayBindingLike(smuggled))).toThrow();
    }
  });

  test('a virtual name outside the shipped slug grammar is refused', () => {
    for (const id of ['Fast', 'fast model', 'fast--model', '-fast']) {
      expect(() => engineGatewaySchema.parse(aGatewayBindingLike({ id }))).toThrow();
    }
  });

  test('a nameless binding is refused, because the listing prints the name', () => {
    expect(() => engineGatewaySchema.parse(aGatewayBindingLike({ displayName: '   ' }))).toThrow();
  });

  test('a binding carries no weight and no second target, because one name stands on one model', () => {
    for (const smuggled of [{ weight: 100 }, { routing: { kind: 'router' } }]) {
      expect(() => engineGatewaySchema.parse(aGatewayBindingLike(smuggled))).toThrow();
    }
  });
});
