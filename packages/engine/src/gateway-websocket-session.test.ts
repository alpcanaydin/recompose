import { expect, test } from 'vitest';

import { closeGatewayWebSocket, openGatewayWebSocket } from './gateway-websocket-client.testkit';
import {
  gatewayConversation,
  gatewayFixture,
  gatewayScript,
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
  expect(first.stats.closes).toBe(1);

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

test('listener drain closes its active xAI upstream exactly once', async () => {
  const upstream = await upstreamFixture();
  const gateway = await gatewayFixture(upstream);
  const active = openGatewayWebSocket(gateway.port, xaiWebSocketPayload);

  await expect(active.firstMessage).resolves.toMatchObject({ type: 'response.completed' });
  await gateway.listeners.close();
  await upstream.disconnected.promise;

  expect(upstream.stats.closes).toBe(1);
  await upstream.close();
});

test('downstream close racing listener drain closes owned upstream exactly once', async () => {
  const upstream = await upstreamFixture();
  const gateway = await gatewayFixture(upstream);
  const active = openGatewayWebSocket(gateway.port, xaiWebSocketPayload);

  await active.firstMessage;
  await Promise.all([closeGatewayWebSocket(active.client), gateway.listeners.close()]);
  await upstream.disconnected.promise;

  expect(upstream.stats.closes).toBe(1);
  await upstream.close();
});

test('preserves compacted xAI context through a generate-false warmup', async () => {
  const upstream = await upstreamFixture();
  const gateway = await gatewayFixture(upstream);
  const trigger = {
    ...xaiWebSocketPayload,
    previous_response_id: 'resp_1',
    input: [{ type: 'compaction_trigger' }],
  };
  const warmup = {
    ...xaiWebSocketPayload,
    previous_response_id: undefined,
    generate: false,
    input: [{ type: 'message', id: 'warm-1', role: 'user', content: 'warm up' }],
  };

  await expect(
    gatewayScript(gateway.port, [
      { payload: xaiWebSocketPayload, answers: 1 },
      { payload: trigger, answers: 1 },
      { payload: warmup, answers: 2 },
      { payload: trigger, answers: 1 },
    ]),
  ).resolves.toHaveLength(5);
  expect(upstream.stats.compactBodies).toHaveLength(2);
  expect(upstream.stats.compactBodies[1]).toHaveProperty('input.0.type', 'compaction');
  expect(upstream.stats.compactBodies[1]).toHaveProperty('input.1.id', 'warm-1');

  await gateway.listeners.close();
  await upstream.close();
});

test('clears pending compacted replay on an empty xAI full reset', async () => {
  const upstream = await upstreamFixture();
  const gateway = await gatewayFixture(upstream);
  const trigger = {
    ...xaiWebSocketPayload,
    previous_response_id: 'resp_1',
    input: [{ type: 'compaction_trigger' }],
  };
  const reset = { ...xaiWebSocketPayload, previous_response_id: undefined, input: [] };
  const append = {
    ...xaiWebSocketPayload,
    type: 'response.append',
    previous_response_id: undefined,
    input: [{ type: 'message', id: 'msg-after-reset', role: 'user', content: 'next' }],
  };

  await expect(
    gatewayConversation(gateway.port, [xaiWebSocketPayload, trigger, reset, append]),
  ).resolves.toHaveLength(4);
  expect(upstream.stats.messages).toHaveLength(3);
  expect(upstream.stats.messages[2]).toHaveProperty('input', [
    { type: 'message', id: 'msg-after-reset', role: 'user', content: 'next' },
  ]);

  await gateway.listeners.close();
  await upstream.close();
});
