import { expect, test } from 'vitest';

import {
  gatewayConversation,
  gatewayFixture,
  upstreamFixture,
  xaiWebSocketPayload,
} from './gateway-websocket.testkit';

test('reuses one xAI upstream WebSocket for consecutive turns on the same target', async () => {
  const upstream = await upstreamFixture();
  const gateway = await gatewayFixture(upstream);
  const second = {
    ...xaiWebSocketPayload,
    previous_response_id: 'resp_1',
    input: [{ role: 'user', content: 'next' }],
  };

  await expect(
    gatewayConversation(gateway.port, [xaiWebSocketPayload, second]),
  ).resolves.toHaveLength(2);
  expect(upstream.stats.connections).toBe(1);
  expect(upstream.stats.messages).toHaveLength(2);
  expect(upstream.stats.messages[1]).toMatchObject({
    type: 'response.create',
    model: 'grok-4.3',
    previous_response_id: 'resp_1',
    store: true,
  });

  await gateway.listeners.close();
  await upstream.close();
});

test('reconnects xAI upstream when the virtual target changes without closing downstream', async () => {
  const first = await upstreamFixture();
  const second = await upstreamFixture();
  const gateway = await gatewayFixture(first, second);
  const changed = { ...xaiWebSocketPayload, model: 'wide', prompt_cache_key: 'ws-session-2' };

  await expect(
    gatewayConversation(gateway.port, [xaiWebSocketPayload, changed]),
  ).resolves.toHaveLength(2);
  expect(first.stats.connections).toBe(1);
  expect(second.stats.connections).toBe(1);
  expect(second.stats.messages[0]).toMatchObject({ model: 'grok-4.5', type: 'response.create' });
  await first.disconnected.promise;

  await gateway.listeners.close();
  await first.close();
  await second.close();
});

test('routes xAI compaction through HTTP and replays compacted state on append', async () => {
  const upstream = await upstreamFixture();
  const gateway = await gatewayFixture(upstream);
  const trigger = {
    ...xaiWebSocketPayload,
    previous_response_id: 'resp_1',
    input: [{ type: 'compaction_trigger' }],
  };
  const append = {
    ...xaiWebSocketPayload,
    type: 'response.append',
    previous_response_id: 'resp_compact',
    input: [{ type: 'message', id: 'msg-2', role: 'user', content: 'second' }],
  };

  await expect(
    gatewayConversation(gateway.port, [xaiWebSocketPayload, trigger, append]),
  ).resolves.toHaveLength(3);
  expect(upstream.stats.compactBodies[0]).toMatchObject({
    model: 'grok-4.3',
    input: [{ role: 'user', content: 'hello' }],
  });
  expect(upstream.stats.compactBodies[0]).not.toHaveProperty('previous_response_id');
  expect(upstream.stats.messages).toHaveLength(2);
  expect(upstream.stats.messages[1]).not.toHaveProperty('previous_response_id');
  expect(upstream.stats.messages[1]).toHaveProperty('input.0.type', 'compaction');
  expect(upstream.stats.messages[1]).toHaveProperty('input.1.id', 'msg-2');

  await gateway.listeners.close();
  await upstream.close();
});
