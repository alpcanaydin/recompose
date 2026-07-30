import { GATEWAY_PORT_RANGE } from '@recompose/contracts';
import { createServer } from 'node:http';
import { describe, expect, test } from 'vitest';

import { probeFreePort } from './probe-free-port';

async function bindLoopback(port: number): Promise<() => Promise<void>> {
  const server = createServer();

  return new Promise((bound, refuse) => {
    server.once('error', refuse);
    server.listen({ port, host: '127.0.0.1' }, () => {
      bound(
        async () =>
          new Promise<void>((closed) => {
            server.close(() => {
              closed();
            });
          }),
      );
    });
  });
}

describe('asking the operating system for a port nothing holds', () => {
  test('the answer sits inside the range a gateway document accepts', async () => {
    const port = await probeFreePort();

    expect(port).toBeGreaterThanOrEqual(GATEWAY_PORT_RANGE.min);
    expect(port).toBeLessThanOrEqual(GATEWAY_PORT_RANGE.max);
  });

  test('the probe lets go of the port, so the gateway it was offered to can take it', async () => {
    const port = await probeFreePort();

    const release = await bindLoopback(port);

    await release();
  });
});
