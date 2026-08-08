import type { RawData } from 'ws';

import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import type { SpendGrantFor } from './gateway-proxy';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { openGatewayListeners } from './gateway-listener';
import { reserveFreePort } from './gateway-listener.testkit';
import { AIStudioRelay } from './provider/ai-studio-relay';

type RelayFixture = {
  port: number;
  connected: string[];
  disconnected: string[];
  close: () => Promise<void>;
};

const refusing: SpendGrantFor = async () => Promise.resolve({ verdict: 'missing-credential' });

async function relayGateway(): Promise<RelayFixture> {
  const connected: string[] = [];
  const disconnected: string[] = [];
  const relay = new AIStudioRelay({
    onConnected: (channelId) => {
      connected.push(channelId);
    },
    onDisconnected: (channelId) => {
      disconnected.push(channelId);
    },
  });
  const port = await reserveFreePort();
  const app = createGatewayApp(
    { ...aGatewayHolding(aVirtualModel()), port },
    refusing,
    globalThis.fetch,
    undefined,
    relay,
  );
  const listeners = await openGatewayListeners(app, port);

  if (!('opened' in listeners)) throw new Error('the gateway listener did not open');

  return { port, connected, disconnected, close: listeners.opened.close };
}

async function openedAt(port: number, path: string): Promise<WebSocket> {
  const client = new WebSocket(`ws://127.0.0.1:${String(port)}${path}`);

  return new Promise<WebSocket>((resolve) => {
    client.once('open', () => {
      resolve(client);
    });
  });
}

async function closedClient(client: WebSocket): Promise<void> {
  return new Promise<void>((resolve) => {
    client.once('close', () => {
      resolve();
    });
    client.close();
  });
}

function frameText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');

  return Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data).toString('utf8');
}

async function nextText(client: WebSocket): Promise<string> {
  return new Promise<string>((resolve) => {
    client.once('message', (data) => {
      resolve(frameText(data));
    });
  });
}

async function settled(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 50);
  });
}

describe('Serving the AI Studio relay channel', () => {
  it('should attach a channel when the browser connects', async () => {
    const fixture = await relayGateway();
    const client = await openedAt(fixture.port, '/v1/ws');

    await closedClient(client);
    await settled();

    expect(fixture.connected).toHaveLength(1);
    await fixture.close();
  });

  it('should answer a channel heartbeat', async () => {
    const fixture = await relayGateway();
    const client = await openedAt(fixture.port, '/v1/ws');

    client.send(JSON.stringify({ id: 'beat-1', type: 'ping', payload: {} }));

    await expect(nextText(client)).resolves.toBe('{"id":"beat-1","type":"pong"}');
    await closedClient(client);
    await fixture.close();
  });

  it('should ignore a channel frame that carries no text', async () => {
    const fixture = await relayGateway();
    const client = await openedAt(fixture.port, '/v1/ws');

    client.send(Buffer.from([1, 2, 3]));
    client.send(JSON.stringify({ id: 'beat-2', type: 'ping', payload: {} }));

    await expect(nextText(client)).resolves.toContain('pong');
    await closedClient(client);
    await fixture.close();
  });

  it('should detach the channel when the browser disconnects', async () => {
    const fixture = await relayGateway();
    const client = await openedAt(fixture.port, '/v1/ws');

    await closedClient(client);
    await settled();

    expect(fixture.disconnected).toHaveLength(1);
    await fixture.close();
  });
});

describe('Serving the unprefixed xAI socket path', () => {
  it('should accept a socket on the unprefixed responses path', async () => {
    const fixture = await relayGateway();
    const client = await openedAt(fixture.port, '/responses');

    expect(client.readyState).toBe(WebSocket.OPEN);
    await closedClient(client);
    await fixture.close();
  });

  it('should end the upstream conversation when the caller sends no text', async () => {
    const fixture = await relayGateway();
    const client = await openedAt(fixture.port, '/v1/responses');

    client.send(Buffer.from([1, 2, 3]));
    await settled();

    expect(client.readyState).toBe(WebSocket.OPEN);
    await closedClient(client);
    await fixture.close();
  });
});
