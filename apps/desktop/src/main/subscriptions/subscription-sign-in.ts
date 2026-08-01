import { setTimeout as sleepFor } from 'node:timers/promises';

import type { SubscriptionObservation } from './subscription-standing';

export type Clock = {
  elapsed: () => number;
  sleep: (ms: number) => Promise<void>;
};

export type SignInWatch = {
  observe: () => Promise<SubscriptionObservation>;
  clock: Clock;
  boundMs: number;
  everyMs: number;
};

export function wallClock(): Clock {
  const started = Date.now();

  return {
    elapsed: () => Date.now() - started,
    sleep: async (ms) => {
      await sleepFor(ms);
    },
  };
}

export async function awaitSignIn(watch: SignInWatch): Promise<SubscriptionObservation | null> {
  for (;;) {
    const seen = await watch.observe();

    if (seen.standing === 'connected') {
      return seen;
    }

    if (watch.clock.elapsed() >= watch.boundMs) {
      return null;
    }

    await watch.clock.sleep(watch.everyMs);
  }
}
