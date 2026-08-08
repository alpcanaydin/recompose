import type { EngineGateway } from '@recompose/contracts';
import type { Hono } from 'hono';
import type { WSEvents } from 'hono/ws';

import { upgradeWebSocket } from '@hono/node-server';

import type { SpendGrantFor } from './gateway-proxy';
import type { AIStudioRelay } from './provider/ai-studio-relay';

import { XAIWebSocketProxy } from './provider/xai-websocket-proxy';

function eventText(data: unknown): string | undefined {
  return typeof data === 'string' ? data : undefined;
}

function xaiWebSocketEvents(
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  fetchLike: typeof fetch,
): WSEvents {
  let proxy: XAIWebSocketProxy | undefined;

  return {
    onOpen(_event, socket) {
      proxy = new XAIWebSocketProxy(socket, gateway, spendGrantFor, fetchLike);
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
  fetchLike: typeof fetch,
  aiStudio: AIStudioRelay,
): void {
  app.get(
    '/v1/ws',
    upgradeWebSocket(() => aiStudioWebSocketEvents(aiStudio)),
  );
  app.get(
    '/v1/responses',
    upgradeWebSocket(() => xaiWebSocketEvents(gateway, spendGrantFor, fetchLike)),
  );
  app.get(
    '/responses',
    upgradeWebSocket(() => xaiWebSocketEvents(gateway, spendGrantFor, fetchLike)),
  );
}

function aiStudioWebSocketEvents(relay: AIStudioRelay): WSEvents {
  let channelId: string | undefined;

  return {
    onOpen(_event, socket) {
      channelId = relay.attach(socket);
    },
    onMessage(event) {
      const text = eventText(Reflect.get(event, 'data'));

      if (channelId !== undefined && text !== undefined) relay.receive(channelId, text);
    },
    onClose() {
      if (channelId !== undefined) relay.detach(channelId);
    },
  };
}
