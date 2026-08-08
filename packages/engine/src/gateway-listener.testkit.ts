import { createServer } from 'node:net';

function portOf(bound: ReturnType<ReturnType<typeof createServer>['address']>): number {
  if (bound === null || typeof bound === 'string') throw new Error('the probe took no port');

  return bound.port;
}

export async function reserveFreePort(): Promise<number> {
  const probe = createServer();

  return new Promise<number>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = portOf(probe.address());

      probe.close(() => {
        resolve(port);
      });
    });
  });
}
