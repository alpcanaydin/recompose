import { GATEWAY_PORT_RANGE } from '@recompose/contracts';
import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, test } from 'vitest';

import { GATEWAY_PORT_BAND } from './free-port';
import { aGatewayCouldTake, probeFreePort } from './probe-free-port';

const HOME = '/Users/ada/Library/Application Support/recompose';

const squatters: Server[] = [];

async function takePort(address: string, port: number): Promise<void> {
  const squatter = createServer();

  squatters.push(squatter);

  return new Promise<void>((taken, refuse) => {
    squatter.once('error', refuse);
    squatter.listen({ port, host: address }, () => {
      taken();
    });
  });
}

async function loopbackIpv6Exists(): Promise<boolean> {
  const probe = createServer();

  return new Promise<boolean>((settle) => {
    probe.once('error', () => {
      settle(false);
    });
    probe.listen(0, '::1', () => {
      probe.close(() => {
        settle(true);
      });
    });
  });
}

const hasIpv6Loopback = await loopbackIpv6Exists();

afterEach(async () => {
  await Promise.all(
    squatters.splice(0).map(
      async (squatter) =>
        new Promise<void>((released) => {
          squatter.close(() => {
            released();
          });
        }),
    ),
  );
});

describe('the port recompose offers a new gateway', () => {
  test('the offer sits inside the range a gateway document accepts', async () => {
    const offered = await probeFreePort(new Set(), HOME);

    expect(offered).toBeGreaterThanOrEqual(GATEWAY_PORT_RANGE.min);
    expect(offered).toBeLessThanOrEqual(GATEWAY_PORT_RANGE.max);
  });

  test('the offer sits below every ephemeral pool, so a reboot cannot hand it away', async () => {
    const offered = await probeFreePort(new Set(), HOME);

    expect(offered).toBeLessThan(GATEWAY_PORT_BAND.first + GATEWAY_PORT_BAND.count);
  });

  test('the offer lets go of the port, so the gateway it was offered to can take it', async () => {
    const offered = await probeFreePort(new Set(), HOME);

    await takePort('127.0.0.1', offered);
  });

  test('a port another process holds on the IPv4 loopback is never offered', async () => {
    const wanted = await probeFreePort(new Set(), HOME);

    await takePort('127.0.0.1', wanted);

    await expect(probeFreePort(new Set(), HOME)).resolves.not.toBe(wanted);
  });

  test.skipIf(!hasIpv6Loopback)(
    'a port another process holds on the IPv6 loopback alone is never offered',
    async () => {
      const wanted = await probeFreePort(new Set(), HOME);

      await expect(probeFreePort(new Set(), HOME)).resolves.toBe(wanted);

      await takePort('::1', wanted);

      await expect(probeFreePort(new Set(), HOME)).resolves.not.toBe(wanted);
    },
  );
});

describe('which loopback binds let a gateway take a port', () => {
  test('both loopback families free means the gateway can take it', () => {
    expect(aGatewayCouldTake('bound', 'bound')).toBe(true);
  });

  test('a machine carrying no IPv6 loopback still lets the gateway take it', () => {
    expect(aGatewayCouldTake('bound', { refusedWith: 'EADDRNOTAVAIL' })).toBe(true);
  });

  test('another process holding the IPv6 loopback alone keeps the gateway out', () => {
    expect(aGatewayCouldTake('bound', { refusedWith: 'EADDRINUSE' })).toBe(false);
  });

  test('another process holding the IPv4 loopback keeps the gateway out', () => {
    expect(aGatewayCouldTake({ refusedWith: 'EADDRINUSE' }, 'bound')).toBe(false);
  });

  test('a port Windows excludes refuses the IPv4 bind, so the gateway stays out', () => {
    expect(aGatewayCouldTake({ refusedWith: 'EACCES' }, 'bound')).toBe(false);
  });
});
