import { createServer } from 'node:net';

/** A loopback port nothing holds, taken and let go so a scenario can type it into the sheet. */
export async function freePort(): Promise<number> {
  return new Promise<number>((settle, refuse) => {
    const probe = createServer();

    probe.once('error', refuse);
    probe.listen({ host: '127.0.0.1', port: 0 }, () => {
      const bound = probe.address();

      if (bound === null || typeof bound === 'string') {
        refuse(new Error('the probe bound no port the scenario could read'));

        return;
      }

      probe.close(() => {
        settle(bound.port);
      });
    });
  });
}
