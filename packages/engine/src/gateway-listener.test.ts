import type { WSEvents } from 'hono/ws';

import { upgradeWebSocket } from '@hono/node-server';
import { Hono } from 'hono';
import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, test } from 'vitest';
import { WebSocket, type RawData } from 'ws';

import { type GatewayListeners, openGatewayListeners } from './gateway-listener';
import { reserveFreePort } from './gateway-listener.testkit';

const openedListeners: GatewayListeners[] = [];
const squatters: Server[] = [];

function anAppAnswering(word: string): Hono {
  return new Hono().get('/health', (c) => c.text(word));
}

function portOf(bound: ReturnType<Server['address']>): number {
  if (bound === null || typeof bound === 'string') {
    throw new Error('the probe took no port');
  }

  return bound.port;
}

async function takePort(address: string, port = 0): Promise<number> {
  const squatter = createServer();

  squatters.push(squatter);

  return new Promise<number>((settle, refuse) => {
    squatter.once('error', refuse);
    squatter.listen(port, address, () => {
      settle(portOf(squatter.address()));
    });
  });
}

async function openAndTrack(app: Hono, port: number): Promise<GatewayListeners> {
  const outcome = await openGatewayListeners(app, port);

  if (!('opened' in outcome)) {
    throw new Error(`the gateway refused to open on port ${port}`);
  }

  openedListeners.push(outcome.opened);

  return outcome.opened;
}

async function closeAndForget(listeners: GatewayListeners): Promise<void> {
  openedListeners.splice(openedListeners.indexOf(listeners), 1);

  await listeners.close();
}

async function askHealthOf(address: string, port: number): Promise<string> {
  const answer = await fetch(`http://${address}:${port}/health`);

  return answer.text();
}

async function websocketEcho(port: number, message: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${String(port)}/ws`);

    socket.once('open', () => {
      socket.send(message);
    });
    socket.once('message', (data) => {
      resolve(messageText(data));
      socket.close();
    });
    socket.once('error', reject);
  });
}

function messageText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString();
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data)).toString();

  return Buffer.from(data).toString();
}

const echoEvents: WSEvents = {
  onMessage(_event, socket) {
    socket.send('recompose');
  },
};

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

async function releasePort(squatter: Server): Promise<void> {
  return new Promise<void>((settle) => {
    squatter.close(() => {
      settle();
    });
  });
}

const hasIpv6Loopback = await loopbackIpv6Exists();

afterEach(async () => {
  await Promise.all(openedListeners.splice(0).map(async (listeners) => listeners.close()));
  await Promise.all(squatters.splice(0).map(releasePort));
});

describe('the address a gateway answers on', () => {
  test('a gateway answers on the IPv4 loopback at its own port', async () => {
    const port = await reserveFreePort();

    await openAndTrack(anAppAnswering('codex'), port);

    expect(await askHealthOf('127.0.0.1', port)).toBe('codex');
  });

  test.skipIf(!hasIpv6Loopback)(
    'the same gateway answers on the IPv6 loopback at the same port',
    async () => {
      const port = await reserveFreePort();

      await openAndTrack(anAppAnswering('codex'), port);

      expect(await askHealthOf('[::1]', port)).toBe('codex');
    },
  );

  test('two gateways keep to their own ports and never answer for each other', async () => {
    const codexPort = await reserveFreePort();
    const geminiPort = await reserveFreePort();

    await openAndTrack(anAppAnswering('codex'), codexPort);
    await openAndTrack(anAppAnswering('gemini'), geminiPort);

    expect(await askHealthOf('127.0.0.1', codexPort)).toBe('codex');
    expect(await askHealthOf('127.0.0.1', geminiPort)).toBe('gemini');
  });
});

describe('a port another process already holds', () => {
  test('the start fails and the failure names the port', async () => {
    const taken = await takePort('127.0.0.1');

    const outcome = await openGatewayListeners(anAppAnswering('codex'), taken);

    expect(outcome).toEqual({ failed: { port: taken } });
  });

  test.skipIf(!hasIpv6Loopback)(
    'a port held on one loopback family alone still fails the whole start',
    async () => {
      const taken = await takePort('::1');

      const outcome = await openGatewayListeners(anAppAnswering('codex'), taken);

      expect(outcome).toEqual({ failed: { port: taken } });
    },
  );

  test.skipIf(!hasIpv6Loopback)('a failed start leaves no half-open sibling behind', async () => {
    const taken = await takePort('::1');

    await openGatewayListeners(anAppAnswering('codex'), taken);

    await expect(takePort('127.0.0.1', taken)).resolves.toBe(taken);
  });
});

describe('stopping a gateway', () => {
  test('the same port reopens the moment the gateway stops', async () => {
    const port = await reserveFreePort();
    const first = await openAndTrack(anAppAnswering('codex'), port);

    await closeAndForget(first);
    await openAndTrack(anAppAnswering('codex'), port);

    expect(await askHealthOf('127.0.0.1', port)).toBe('codex');
  });

  test('a stopped gateway answers nothing at all', async () => {
    const port = await reserveFreePort();
    const listeners = await openAndTrack(anAppAnswering('codex'), port);

    await closeAndForget(listeners);

    await expect(askHealthOf('127.0.0.1', port)).rejects.toThrow();
  });
});

test('the gateway upgrades a real loopback WebSocket connection', async () => {
  const port = await reserveFreePort();
  const app = new Hono();

  app.get(
    '/ws',
    upgradeWebSocket(() => echoEvents),
  );
  await openAndTrack(app, port);

  await expect(websocketEcho(port, 'recompose')).resolves.toBe('recompose');
});
