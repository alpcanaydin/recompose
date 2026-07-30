import type { Hono } from 'hono';

import { getRequestListener } from '@hono/node-server';
import { createServer, type Server } from 'node:http';

const IPV4_LOOPBACK = '127.0.0.1';
const IPV6_LOOPBACK = '::1';

export type GatewayListeners = {
  close: () => Promise<void>;
};

type BindOutcome = { bound: Server } | { refused: 'port-taken' | 'address-unavailable' };

type OpenOutcome = { opened: GatewayListeners } | { failed: { port: number } };

async function bindTo(app: Hono, address: string, port: number): Promise<BindOutcome> {
  const answer = getRequestListener(app.fetch);

  return new Promise<BindOutcome>((settle) => {
    const server = createServer((incoming, outgoing) => {
      void answer(incoming, outgoing);
    });

    server.once('error', (error: NodeJS.ErrnoException) => {
      settle({ refused: error.code === 'EADDRINUSE' ? 'port-taken' : 'address-unavailable' });
    });
    server.listen({ port, host: address }, () => {
      settle({ bound: server });
    });
  });
}

async function stopServing(server: Server): Promise<void> {
  return new Promise<void>((settle) => {
    server.close(() => {
      settle();
    });
    server.closeAllConnections();
  });
}

function isBound(outcome: BindOutcome): outcome is { bound: Server } {
  return 'bound' in outcome;
}

export async function openGatewayListeners(app: Hono, port: number): Promise<OpenOutcome> {
  const overIpv4 = await bindTo(app, IPV4_LOOPBACK, port);

  if (!isBound(overIpv4)) {
    return { failed: { port } };
  }

  const overIpv6 = await bindTo(app, IPV6_LOOPBACK, port);

  if (!isBound(overIpv6) && overIpv6.refused === 'port-taken') {
    await stopServing(overIpv4.bound);

    return { failed: { port } };
  }

  const serving = [overIpv4, overIpv6].filter(isBound).map((outcome) => outcome.bound);

  return {
    opened: {
      close: async () => {
        await Promise.all(serving.map(stopServing));
      },
    },
  };
}
