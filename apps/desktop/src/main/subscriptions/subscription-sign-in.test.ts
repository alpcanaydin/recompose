import { describe, expect, test } from 'vitest';

import type { SubscriptionObservation } from './subscription-standing';

import { awaitSignIn, wallClock } from './subscription-sign-in';
import { fakeClock } from './subscriptions.testkit';

function observesInTurn(readings: readonly SubscriptionObservation[]) {
  let turn = 0;
  const looks: number[] = [];

  return {
    looks,
    observe: async (): Promise<SubscriptionObservation> => {
      looks.push(turn);
      const reading = readings[turn] ?? { standing: 'lapsed' as const };

      turn += 1;

      return Promise.resolve(reading);
    },
  };
}

describe('waiting for the provider tool to finish signing somebody in', () => {
  test('given the tool already signed in, the wait answers on its first look', async () => {
    const watcher = observesInTurn([{ standing: 'connected', signedInAs: 'ada@ex.com' }]);

    const answered = await awaitSignIn({
      observe: watcher.observe,
      clock: fakeClock(),
      boundMs: 1000,
      everyMs: 100,
    });

    expect(answered).toEqual({ standing: 'connected', signedInAs: 'ada@ex.com' });
    expect(watcher.looks).toHaveLength(1);
  });

  test('given the tool signs in part way through, the wait answers as soon as it does', async () => {
    const watcher = observesInTurn([
      { standing: 'lapsed' },
      { standing: 'lapsed' },
      { standing: 'connected', plan: 'max' },
    ]);

    const answered = await awaitSignIn({
      observe: watcher.observe,
      clock: fakeClock(),
      boundMs: 1000,
      everyMs: 100,
    });

    expect(answered).toEqual({ standing: 'connected', plan: 'max' });
    expect(watcher.looks).toHaveLength(3);
  });

  test('given the bound passes with nobody signed in, the wait answers nobody', async () => {
    const watcher = observesInTurn([]);

    const answered = await awaitSignIn({
      observe: watcher.observe,
      clock: fakeClock(),
      boundMs: 300,
      everyMs: 100,
    });

    expect(answered).toBeNull();
    expect(watcher.looks).toHaveLength(4);
  });
});

describe('the clock the wait runs against', () => {
  test('given a fresh clock, no time has passed yet, and sleeping lets some pass', async () => {
    const clock = wallClock();

    expect(clock.elapsed()).toBeLessThan(1000);

    await clock.sleep(5);

    expect(clock.elapsed()).toBeGreaterThanOrEqual(4);
  });
});
