import { expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { optimizeCodexMultiAgent } from './codex-multi-agent';

function spawnNamespace(): JsonObject {
  return {
    type: 'namespace',
    name: 'collaboration',
    tools: [{ type: 'function', name: 'spawn_agent', description: 'Spawns an agent.' }],
  };
}

test('strips the encrypted message field from the collaboration tools', () => {
  const body = optimizeCodexMultiAgent({
    model: 'gpt-5.4',
    tools: [
      {
        type: 'function',
        name: 'send_message',
        parameters: { properties: { message: { type: 'string', encrypted: true } } },
      },
      { type: 'function', name: 'followup_task', parameters: 'none' },
      { type: 'function', name: 'spawn_agent', parameters: { properties: {} } },
    ],
  });

  expect(body).toHaveProperty('tools.0.parameters.properties.message', { type: 'string' });
  expect(body).toHaveProperty('tools.1.parameters', 'none');
  expect(body).toHaveProperty('tools.2.parameters.properties', {});
});

test('lists the configured model overrides on the spawn agent tool', () => {
  const body = optimizeCodexMultiAgent(
    { tools: [spawnNamespace()] },
    { models: [{ id: 'gpt-5.4', description: 'Frontier model.', reasoningEfforts: [] }] },
  );

  expect(JSON.stringify(body)).toContain('- `gpt-5.4`: Frontier model.');
  expect(body).toHaveProperty('tools.0.name', 'collaboration-optimize');
});

test('offers the requested model as the only override when none are configured', () => {
  const named = optimizeCodexMultiAgent({ model: 'gpt-5.4', tools: [spawnNamespace()] });

  expect(JSON.stringify(named)).toContain('- `gpt-5.4`');
  expect(named).toHaveProperty('tools.0.name', 'collaboration-optimize');
});

test('leaves the collaboration namespace named as it arrived when no model is known', () => {
  const anonymous = optimizeCodexMultiAgent({ tools: [spawnNamespace()] });

  expect(anonymous).toHaveProperty('tools.0.name', 'collaboration');
  expect(JSON.stringify(anonymous)).not.toContain('Available model overrides');
});

test('reveals encrypted agent message parts and leaves other input alone', () => {
  const body = optimizeCodexMultiAgent({
    model: 'gpt-5.4',
    tools: ['plain'],
    input: [
      'plain',
      {
        type: 'agent_message',
        content: [
          { type: 'encrypted_content', encrypted_content: 'hello' },
          { type: 'encrypted_content', encrypted_content: 7 },
          { type: 'input_text', text: 'kept' },
          'raw',
        ],
      },
      { type: 'message', role: 'user' },
    ],
  });

  expect(body).toHaveProperty('input.1.content.0', { type: 'input_text', text: 'hello' });
  expect(body).toHaveProperty('input.1.content.1', {
    type: 'encrypted_content',
    encrypted_content: 7,
  });
  expect(body).toHaveProperty('input.1.content.3', 'raw');
  expect(body).toHaveProperty('tools.0', 'plain');
});
