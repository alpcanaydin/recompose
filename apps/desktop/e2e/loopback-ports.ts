import { createServer, type Server } from 'node:net';

const LOOPBACK_HOSTS = ['127.0.0.1', '::1'];

/** Binds one loopback family, answering with nothing when that family refuses the port. */
async function holdPort(host: string, port: number): Promise<Server | null> {
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

async function dropServer(server: Server): Promise<void> {
  return new Promise<void>((settle) => {
    server.close(() => {
      settle();
    });
  });
}

/** A loopback port nothing holds, taken and let go so a scenario can type it into a field. */
export async function freePort(): Promise<number> {
  const [host = ''] = LOOPBACK_HOSTS;
  const probe = await holdPort(host, 0);

  if (probe === null) {
    throw new Error('the scenario found no loopback port to offer');
  }

  const bound = probe.address();

  await dropServer(probe);

  if (bound === null || typeof bound === 'string') {
    throw new Error('the probe bound no port the scenario could read');
  }

  return bound.port;
}

/** Whether a port is genuinely there for the taking, proved by taking it and letting go. */
export async function portIsFree(port: number): Promise<boolean> {
  const probe = await holdPort('127.0.0.1', port);

  if (probe === null) {
    return false;
  }

  await dropServer(probe);

  return true;
}
