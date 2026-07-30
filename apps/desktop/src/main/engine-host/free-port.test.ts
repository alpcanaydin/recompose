import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { offerFreePort } from './free-port';

function probeAnswering(ports: readonly number[]): () => Promise<number> {
  let answered = 0;

  return async () => {
    const port = ports[answered % ports.length];

    answered += 1;

    return Promise.resolve(port ?? 0);
  };
}

const anyPort = fc.integer({ min: 1024, max: 65535 });

describe('offering a port the creation sheet can keep', () => {
  test('a port no gateway holds is the port on offer', async () => {
    await expect(offerFreePort(new Set([8397]), probeAnswering([51234]))).resolves.toBe(51234);
  });

  test('a port a gateway already holds sends the probe back out', async () => {
    await expect(
      offerFreePort(new Set([8397, 8398]), probeAnswering([8397, 8398, 51234])),
    ).resolves.toBe(51234);
  });

  test('a probe that keeps answering taken ports fails loudly rather than offering one', async () => {
    await expect(offerFreePort(new Set([8397]), probeAnswering([8397]), 3)).rejects.toThrow(
      'free port',
    );
  });

  test('the last attempt still counts, so an offer arrives on the final probe', async () => {
    await expect(
      offerFreePort(new Set([8397]), probeAnswering([8397, 8397, 51234]), 3),
    ).resolves.toBe(51234);
  });

  test('the attempt count is a ceiling, so no probe runs past it', async () => {
    await expect(
      offerFreePort(new Set([8397]), probeAnswering([8397, 8397, 51234]), 2),
    ).rejects.toThrow('free port');
  });

  test('a probe that cannot bind carries its own failure out rather than looping', async () => {
    const refusingProbe = async (): Promise<number> =>
      Promise.reject(new Error('the loopback probe could not bind'));

    await expect(offerFreePort(new Set(), refusingProbe)).rejects.toThrow(
      'the loopback probe could not bind',
    );
  });

  test.prop([fc.array(anyPort), fc.array(anyPort, { minLength: 1 })])(
    'an offer that arrives is never a port a stored gateway holds',
    async (stored, probed) => {
      const taken = new Set(stored);

      const offered = await offerFreePort(taken, probeAnswering(probed), 64).catch(() => null);

      expect(offered === null || !taken.has(offered)).toBe(true);
    },
  );
});
