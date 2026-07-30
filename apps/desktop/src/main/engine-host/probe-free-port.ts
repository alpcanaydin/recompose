import { createServer } from 'node:http';

const IPV4_LOOPBACK = '127.0.0.1';

export async function probeFreePort(): Promise<number> {
  const probe = createServer();

  return new Promise<number>((answer, refuse) => {
    probe.once('error', refuse);
    probe.listen({ port: 0, host: IPV4_LOOPBACK }, () => {
      const bound = probe.address();

      probe.close(() => {
        if (bound === null || typeof bound === 'string') {
          refuse(
            new Error(
              'The operating system offered no port number when recompose asked for a free one.',
            ),
          );

          return;
        }

        answer(bound.port);
      });
    });
  });
}
