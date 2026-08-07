import { expect, test } from 'vitest';

import {
  gatewayExchange,
  gatewayFixture,
  upstreamFixture,
  xaiWebSocketPayload,
} from './gateway-websocket.testkit';

test('proxies a real xAI Responses WebSocket and closes its upstream lifecycle', async () => {
  const upstream = await upstreamFixture();
  const gateway = await gatewayFixture(upstream);

  await expect(gatewayExchange(gateway.port, xaiWebSocketPayload)).resolves.toMatchObject({
    type: 'response.completed',
  });
  await expect(upstream.received.promise).resolves.toMatchObject({
    type: 'response.create',
    model: 'grok-4.3',
    store: true,
    prompt_cache_key: 'ws-session',
    previous_response_id: 'resp_previous',
  });
  expect(upstream.request().path).toBe('/v1/responses');
  expect(upstream.request().headers.authorization).toBe('Bearer xai-ws-credential');
  expect(upstream.request().headers['x-grok-conv-id']).toBe('ws-session');
  await upstream.disconnected.promise;
  await gateway.listeners.close();
  await upstream.close();
});

test.each([
  ['bare-error', 400, undefined],
  ['message-too-big', 413, 'message_too_big'],
  ['handshake-429', 429, 'subscription:free-usage-exhausted'],
] as const)('maps xAI WebSocket %s failures downstream', async (mode, status, code) => {
  const upstream = await upstreamFixture(mode);
  const gateway = await gatewayFixture(upstream);
  const result = await gatewayExchange(gateway.port, xaiWebSocketPayload);

  expect(result).toMatchObject({ type: 'error', status });
  if (code !== undefined) expect(result).toHaveProperty('error.code', code);
  if (status === 429) expect(result).toHaveProperty('retry_after_seconds', 86_400);

  await gateway.listeners.close();
  await upstream.close();
});
