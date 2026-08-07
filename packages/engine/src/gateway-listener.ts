import type { Hono } from 'hono';

import { createAdaptorServer, type ServerType } from '@hono/node-server';
import { createServer } from 'node:http';

import { NodeWebSocketServer } from './node-websocket-server';

const IPV4_LOOPBACK = '127.0.0.1';
const IPV6_LOOPBACK = '::1';

export type GatewayListeners = {
  close: () => Promise<void>;
};

type BoundListener = { server: ServerType; websocket: NodeWebSocketServer };
type BindOutcome = { bound: BoundListener } | { refused: 'port-taken' | 'address-unavailable' };

type OpenOutcome = { opened: GatewayListeners } | { failed: { port: number } };

async function bindTo(app: Hono, address: string, port: number): Promise<BindOutcome> {
  return new Promise<BindOutcome>((settle) => {
    const websocket = new NodeWebSocketServer();
    const server = createAdaptorServer({
      fetch: app.fetch,
      createServer,
      websocket: { server: websocket },
    });

    const refuseTheBind = (error: NodeJS.ErrnoException): void => {
      settle({ refused: error.code === 'EADDRINUSE' ? 'port-taken' : 'address-unavailable' });
    };

    server.once('error', refuseTheBind);
    server.listen({ port, host: address }, () => {
      server.off('error', refuseTheBind);
      server.on('error', (error: NodeJS.ErrnoException) => {
        console.error(`The gateway listening on ${address}:${String(port)} hit an error.`, error);
      });
      settle({ bound: { server, websocket } });
    });
  });
}

function closeAllConnections(server: ServerType): void {
  if ('closeAllConnections' in server && typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
}

async function stopServing(bound: BoundListener): Promise<void> {
  bound.websocket.terminateAll();
  bound.websocket.close();

  return new Promise<void>((settle) => {
    bound.server.close(() => {
      settle();
    });
    closeAllConnections(bound.server);
  });
}

function isBound(outcome: BindOutcome): outcome is { bound: BoundListener } {
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
