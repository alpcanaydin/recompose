import { createServer } from 'node:http';

import { portFromAddress } from './port-from-address';

const IPV4_LOOPBACK = '127.0.0.1';

export async function probeFreePort(): Promise<number> {
  const probe = createServer();

  return new Promise<number>((answer, refuse) => {
    probe.once('error', refuse);
    probe.listen({ port: 0, host: IPV4_LOOPBACK }, () => {
      const bound = probe.address();

      probe.close(() => {
        try {
          answer(portFromAddress(bound));
        } catch (error) {
          refuse(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  });
}
