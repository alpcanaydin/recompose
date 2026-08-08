import { WebSocket } from 'ws';

import { parsedJson } from './gateway-wire';
import { xaiWebSocketText } from './provider/xai-websocket-wire';

type ActiveClient = { client: WebSocket; firstMessage: Promise<unknown> };

export function openGatewayWebSocket(port: number, payload: unknown): ActiveClient {
  const client = new WebSocket(`ws://127.0.0.1:${String(port)}/v1/responses`);
  const firstMessage = new Promise<unknown>((resolve, reject) => {
    client.once('open', () => {
      client.send(JSON.stringify(payload));
    });
    client.once('message', (data) => {
      resolve(parsedJson(xaiWebSocketText(data)));
    });
    client.once('error', reject);
  });

  return { client, firstMessage };
}

export async function closeGatewayWebSocket(client: WebSocket): Promise<void> {
  if (client.readyState === WebSocket.CLOSED) return;

  return new Promise<void>((resolve) => {
    client.once('close', () => {
      resolve();
    });
    client.close();
  });
}
