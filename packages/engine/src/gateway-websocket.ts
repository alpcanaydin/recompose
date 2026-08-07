import type { EngineGateway } from '@recompose/contracts';
import type { Hono } from 'hono';
import type { WSEvents } from 'hono/ws';

import { upgradeWebSocket } from '@hono/node-server';

import type { SpendGrantFor } from './gateway-proxy';

import { XAIWebSocketProxy } from './provider/xai-websocket-proxy';

function eventText(data: unknown): string | undefined {
  return typeof data === 'string' ? data : undefined;
}

function xaiWebSocketEvents(gateway: EngineGateway, spendGrantFor: SpendGrantFor): WSEvents {
  let proxy: XAIWebSocketProxy | undefined;

  return {
    onOpen(_event, socket) {
      proxy = new XAIWebSocketProxy(socket, gateway, spendGrantFor);
    },
    onMessage(event) {
      const text = eventText(Reflect.get(event, 'data'));

      if (text === undefined) proxy?.close();
      else void proxy?.receive(text);
    },
    onClose() {
      proxy?.close();
    },
  };
}

export function registerGatewayWebSockets(
  app: Hono,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
): void {
  app.get(
    '/v1/responses',
    upgradeWebSocket(() => xaiWebSocketEvents(gateway, spendGrantFor)),
  );
  app.get(
    '/responses',
    upgradeWebSocket(() => xaiWebSocketEvents(gateway, spendGrantFor)),
  );
}
