import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import type { Fate } from './fates';

import { accountForEveryKey } from './fates';

const fieldName = fc.string({ minLength: 1, maxLength: 16 });

const sourceKeysWithRouted = fc
  .uniqueArray(fieldName, { maxLength: 8 })
  .chain((keys) => fc.subarray(keys).map((routedKeys) => ({ keys, routedKeys })));

describe('the leftover-key diff that lets no field escape the ledger', () => {
  test('a source key the fold never routed lands a mapped-to-absent fate', () => {
    const routed: Fate[] = [{ field: 'model', disposition: 'carried' }];

    const leftovers = accountForEveryKey(['model', 'stream'], routed);

    expect(leftovers).toEqual([{ field: 'stream', disposition: 'mapped', to: 'absent' }]);
  });

  test('with nothing yet routed, every source key lands a mapped-to-absent fate in order', () => {
    expect(accountForEveryKey(['model', 'stream'], [])).toEqual([
      { field: 'model', disposition: 'mapped', to: 'absent' },
      { field: 'stream', disposition: 'mapped', to: 'absent' },
    ]);
  });

  test('a key the fold already carried draws no second fate', () => {
    const routed: Fate[] = [{ field: 'model', disposition: 'carried' }];

    expect(accountForEveryKey(['model'], routed)).toEqual([]);
  });

  test('a source object every fate already names adds nothing to the ledger', () => {
    const routed: Fate[] = [
      { field: 'model', disposition: 'carried' },
      { field: 'messages', disposition: 'mapped', to: 'input' },
      {
        field: 'temperature',
        disposition: 'refused',
        reason: 'the sampling value maps to nothing',
      },
    ];

    expect(accountForEveryKey(['model', 'messages', 'temperature'], routed)).toEqual([]);
  });

  test.prop([sourceKeysWithRouted])(
    'every source key lands exactly one fate once the diff has run',
    ({ keys, routedKeys }) => {
      const routed: Fate[] = routedKeys.map((field) => ({ field, disposition: 'carried' }));

      const ledger = [...routed, ...accountForEveryKey(keys, routed)];

      for (const key of keys) {
        expect(ledger.filter((fate) => fate.field === key)).toHaveLength(1);
      }
    },
  );

  test.prop([sourceKeysWithRouted])(
    'the diff names only source keys the fold left unrouted, each mapped to absent',
    ({ keys, routedKeys }) => {
      const routed: Fate[] = routedKeys.map((field) => ({ field, disposition: 'carried' }));

      for (const fate of accountForEveryKey(keys, routed)) {
        expect(keys).toContain(fate.field);
        expect(routedKeys).not.toContain(fate.field);
        expect(fate).toEqual({ field: fate.field, disposition: 'mapped', to: 'absent' });
      }
    },
  );
});
