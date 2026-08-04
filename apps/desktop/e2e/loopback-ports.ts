import type { AddressInfo } from 'node:net';

import { createServer, type Server } from 'node:net';

export const LOOPBACK_HOSTS = ['127.0.0.1', '::1'];

/** Binds one loopback family, answering with nothing when that family refuses the port. */
export async function holdPort(host: string, port: number): Promise<Server | null> {
  return new Promise<Server | null>((settle) => {
    const server = createServer();

    server.once('error', () => {
      settle(null);
    });
    server.listen({ host, port }, () => {
      settle(server);
    });
  });
}

/** Binds a stub's own server to a loopback port the machine had free, and reads that port back. */
export async function bindToAFreePort(server: Server, host: string): Promise<number> {
  return new Promise<number>((settle, refuse) => {
    server.once('error', refuse);
    server.listen({ host, port: 0 }, () => {
      const bound = server.address();

      if (bound === null || typeof bound === 'string') {
        refuse(new Error('the stub bound no port the scenario could read'));

        return;
      }

      settle(bound.port);
    });
  });
}

export async function dropServer(server: Server): Promise<void> {
  return new Promise<void>((settle) => {
    server.close(() => {
      settle();
    });
  });
}

/** A loopback port nothing holds, taken and let go so a scenario can type it into a field. */
export async function freePort(): Promise<number> {
  const [first = ''] = LOOPBACK_HOSTS;
  const probe = await holdPort(first, 0);

  if (probe === null) {
    throw new Error('the scenario found no loopback port to offer');
  }

  const bound = probe.address();

  await dropServer(probe);

  return portNothingHolds(bound);
}

async function portNothingHolds(bound: AddressInfo | string | null): Promise<number> {
  if (bound === null || typeof bound === 'string') {
    throw new Error('the probe bound no port the scenario could read');
  }

  if (!(await portIsFree(bound.port))) {
    throw new Error(
      `the scenario found port ${String(bound.port)} free on one loopback family and held on another`,
    );
  }

  return bound.port;
}

/** Whether a port is genuinely there for the taking, proved by taking it and letting go. */
export async function portIsFree(port: number): Promise<boolean> {
  const probes = await Promise.all(LOOPBACK_HOSTS.map(async (host) => holdPort(host, port)));
  const taken = probes.some((probe) => probe === null);

  await Promise.all(
    probes.filter((probe) => probe !== null).map(async (probe) => dropServer(probe)),
  );

  return !taken;
}
