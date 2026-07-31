import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { GATEWAY_PORT_BAND, offerFreePort } from './free-port';

const HOME = '/Users/ada/Library/Application Support/recompose';

const lastInBand = GATEWAY_PORT_BAND.first + GATEWAY_PORT_BAND.count - 1;

const wholeBand = Array.from(
  { length: GATEWAY_PORT_BAND.count },
  (_unused, step) => GATEWAY_PORT_BAND.first + step,
);

const everyPortFree = async (): Promise<boolean> => Promise.resolve(true);

function everyPortFreeBut(held: readonly number[]): (port: number) => Promise<boolean> {
  return async (port) => Promise.resolve(!held.includes(port));
}

const anInstallFolder = fc.webPath().map((path) => `/Users/ada${path}`);

describe('offering a gateway a port of its own', () => {
  test('the offer sits inside the band recompose keeps for gateways', async () => {
    const offered = await offerFreePort(new Set(), HOME, everyPortFree);

    expect(offered).toBeGreaterThanOrEqual(GATEWAY_PORT_BAND.first);
    expect(offered).toBeLessThanOrEqual(lastInBand);
  });

  test('a port a stored gateway holds is stepped over', async () => {
    const first = await offerFreePort(new Set(), HOME, everyPortFree);

    await expect(offerFreePort(new Set([first]), HOME, everyPortFree)).resolves.not.toBe(first);
  });

  test('a port another process holds is stepped over', async () => {
    const first = await offerFreePort(new Set(), HOME, everyPortFree);

    await expect(offerFreePort(new Set(), HOME, everyPortFreeBut([first]))).resolves.not.toBe(
      first,
    );
  });

  test('the same install is offered the same port every time, so a copied address keeps working', async () => {
    const offered = await offerFreePort(new Set(), HOME, everyPortFree);

    await expect(offerFreePort(new Set(), HOME, everyPortFree)).resolves.toBe(offered);
  });

  test('an install keeps the exact port it was given, so no release moves an address', async () => {
    await expect(offerFreePort(new Set(), HOME, everyPortFree)).resolves.toBe(8436);
  });

  test('the walk wraps to the bottom of the band rather than running past the top', async () => {
    await expect(offerFreePort(new Set([8436]), HOME, everyPortFree)).resolves.toBe(
      GATEWAY_PORT_BAND.first,
    );
  });
});

describe('two installs sharing one machine', () => {
  test.prop([fc.uniqueArray(anInstallFolder, { minLength: 8, maxLength: 24 })])(
    'they are not all sent to the same end of the band',
    async (folders) => {
      const offered = await Promise.all(
        folders.map(async (folder) => offerFreePort(new Set(), folder, everyPortFree)),
      );

      expect(new Set(offered).size).toBeGreaterThan(1);
    },
  );
});

describe('a band with no room left', () => {
  test('the failure names the band rather than offering a port outside it', async () => {
    await expect(offerFreePort(new Set(wholeBand), HOME, everyPortFree)).rejects.toThrow(
      String(GATEWAY_PORT_BAND.first),
    );
  });

  test('every port in the band is tried, and nothing outside it ever is', async () => {
    const tried: number[] = [];
    const noneFree = async (port: number): Promise<boolean> => {
      tried.push(port);

      return Promise.resolve(false);
    };

    await expect(offerFreePort(new Set(), HOME, noneFree)).rejects.toThrow();
    expect(new Set(tried)).toEqual(new Set(wholeBand));
  });

  test('a proof that cannot bind at all carries its own failure out rather than looping', async () => {
    const refusingProof = async (): Promise<boolean> =>
      Promise.reject(new Error('the loopback proof could not bind'));

    await expect(offerFreePort(new Set(), HOME, refusingProof)).rejects.toThrow(
      'the loopback proof could not bind',
    );
  });
});

describe('what an offer never is', () => {
  test.prop([
    fc.array(fc.integer({ min: GATEWAY_PORT_BAND.first, max: lastInBand })),
    anInstallFolder,
  ])('never a port a stored gateway already holds', async (stored, folder) => {
    const taken = new Set(stored);

    const offered = await offerFreePort(taken, folder, everyPortFree).catch(() => null);

    expect(offered === null || !taken.has(offered)).toBe(true);
  });
});
