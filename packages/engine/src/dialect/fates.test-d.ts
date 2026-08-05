import { describe, expectTypeOf, test } from 'vitest';

import type { Fate, TranslateResult, Translated } from './fates';

describe('the three fates every crossing field lands in', () => {
  test('a fate is carried, mapped, or refused and never a fourth', () => {
    expectTypeOf<Fate['disposition']>().toEqualTypeOf<'carried' | 'mapped' | 'refused'>();
  });

  test('a carried field names itself and carries no mapping or reason', () => {
    expectTypeOf<Extract<Fate, { disposition: 'carried' }>>().toEqualTypeOf<{
      field: string;
      disposition: 'carried';
    }>();
    expectTypeOf<Extract<Fate, { disposition: 'carried' }>>().not.toHaveProperty('to');
    expectTypeOf<Extract<Fate, { disposition: 'carried' }>>().not.toHaveProperty('reason');
  });

  test('a mapped field names where it went and whether the move bore a cost', () => {
    expectTypeOf<Extract<Fate, { disposition: 'mapped' }>>().toEqualTypeOf<{
      field: string;
      disposition: 'mapped';
      to: string;
      costBearing?: true;
    }>();
  });

  test('a refused field carries the reason the crossing stopped', () => {
    expectTypeOf<Extract<Fate, { disposition: 'refused' }>['reason']>().toEqualTypeOf<string>();
    expectTypeOf<Extract<Fate, { disposition: 'refused' }>>().not.toHaveProperty('to');
  });
});

describe('the envelope a translation carries back', () => {
  test('a translated body travels beside its readonly fate ledger', () => {
    expectTypeOf<Translated<{ id: string }>>().toEqualTypeOf<{
      value: { id: string };
      fates: readonly Fate[];
    }>();
  });

  test('a result is either a translation or a typed refusal, generic over the refusal', () => {
    type SampleRefusal = { status: 404 };

    expectTypeOf<TranslateResult<{ id: string }, SampleRefusal>>().toEqualTypeOf<
      Translated<{ id: string }> | { refusal: SampleRefusal }
    >();
  });
});
