import { expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { normalizeKimiToolHistory } from './kimi-tool-history';

function normalized(messages: unknown[]): unknown[] {
  const value = normalizeKimiToolHistory({ messages })['messages'];

  return Array.isArray(value) ? value : [];
}

function assistantCall(id: string, extra: JsonObject = {}): JsonObject {
  return {
    role: 'assistant',
    tool_calls: [{ id, type: 'function', function: { name: 'list_directory', arguments: '{}' } }],
    ...extra,
  };
}

test('uses call_id as the Kimi tool_call_id fallback', () => {
  const messages = normalized([
    assistantCall('list_directory:1'),
    { role: 'tool', call_id: 'list_directory:1', content: '[]' },
  ]);

  expect(messages).toHaveProperty('1.tool_call_id', 'list_directory:1');
});

test('infers a single pending Kimi tool call', () => {
  const messages = normalized([
    assistantCall('call_123'),
    { role: 'tool', content: 'file-content' },
  ]);

  expect(messages).toHaveProperty('1.tool_call_id', 'call_123');
});

test('does not infer an ambiguous Kimi tool call', () => {
  const assistant = {
    role: 'assistant',
    tool_calls: [
      { id: 'call_1', type: 'function', function: { name: 'list', arguments: '{}' } },
      { id: 'call_2', type: 'function', function: { name: 'read', arguments: '{}' } },
    ],
  };
  const messages = normalized([assistant, { role: 'tool', content: 'result' }]);

  expect(messages).not.toHaveProperty('1.tool_call_id');
});

test('preserves an existing Kimi tool_call_id', () => {
  const messages = normalized([
    assistantCall('call_1'),
    { role: 'tool', tool_call_id: 'call_1', call_id: 'different-id', content: 'result' },
  ]);

  expect(messages).toHaveProperty('1.tool_call_id', 'call_1');
});

test('inherits previous assistant reasoning for a tool call', () => {
  const messages = normalized([
    { role: 'assistant', content: 'plan', reasoning_content: 'previous reasoning' },
    assistantCall('call_1'),
  ]);

  expect(messages).toHaveProperty('1.reasoning_content', 'previous reasoning');
});

test('inserts a stable fallback when assistant reasoning is unavailable', () => {
  const messages = normalized([assistantCall('call_1')]);

  expect(messages).toHaveProperty('0.reasoning_content', '[reasoning unavailable]');
});

test('uses assistant content parts as reasoning fallback', () => {
  const messages = normalized([
    assistantCall('call_1', {
      content: [
        { type: 'text', text: 'first line' },
        { type: 'text', text: 'second line' },
      ],
    }),
  ]);

  expect(messages).toHaveProperty('0.reasoning_content', 'first line\nsecond line');
});

test('replaces empty reasoning content with assistant content', () => {
  const messages = normalized([
    assistantCall('call_1', { content: 'assistant summary', reasoning_content: '' }),
  ]);

  expect(messages).toHaveProperty('0.reasoning_content', 'assistant summary');
});

test('preserves existing assistant reasoning', () => {
  const messages = normalized([assistantCall('call_1', { reasoning_content: 'keep me' })]);

  expect(messages).toHaveProperty('0.reasoning_content', 'keep me');
});

test('repairs reasoning and multiple tool result IDs together', () => {
  const messages = normalized([
    assistantCall('call_1', { reasoning_content: 'r1' }),
    { role: 'tool', call_id: 'call_1', content: '[]' },
    assistantCall('call_2'),
    { role: 'tool', call_id: 'call_2', content: 'file' },
  ]);

  expect(messages).toHaveProperty('1.tool_call_id', 'call_1');
  expect(messages).toHaveProperty('2.reasoning_content', 'r1');
  expect(messages).toHaveProperty('3.tool_call_id', 'call_2');
});

test('drops empty assistant messages without tool or reasoning links', () => {
  const messages = normalized([
    { role: 'user', content: 'start' },
    { role: 'assistant', content: '' },
    { role: 'assistant', content: '   ' },
    { role: 'assistant', content: '', tool_calls: null },
    { role: 'assistant', content: [{ type: 'text', text: '  ' }] },
    { role: 'assistant' },
    { role: 'assistant', content: 'keep' },
    { role: 'user', content: 'next' },
  ]);

  expect(messages).toEqual([
    { role: 'user', content: 'start' },
    { role: 'assistant', content: 'keep' },
    { role: 'user', content: 'next' },
  ]);
});

test('preserves assistants linked by tools, function calls, reasoning, or visible content', () => {
  const messages = normalized([
    assistantCall('call_1', { content: '' }),
    { role: 'assistant', content: '', function_call: { name: 'legacy', arguments: '{}' } },
    { role: 'assistant', content: '', reasoning_content: 'thought' },
    { role: 'assistant', content: [{ type: 'text', text: ' visible ' }] },
  ]);

  expect(messages).toHaveLength(4);
  expect(messages).toHaveProperty('0.tool_calls');
  expect(messages).toHaveProperty('1.function_call');
  expect(messages).toHaveProperty('2.reasoning_content', 'thought');
  expect(messages).toHaveProperty('3.content.0.text', ' visible ');
});

test('leaves a body that carries no message list untouched', () => {
  const body = { model: 'kimi-k2', prompt: 'hello' };

  expect(normalizeKimiToolHistory(body)).toBe(body);
});

test('leaves an entry that is not a message untouched', () => {
  const messages = normalized(['loose text', 42, { role: 'user', content: 'hi' }]);

  expect(messages).toEqual(['loose text', 42, { role: 'user', content: 'hi' }]);
});

test('drops an assistant whose every content part says nothing', () => {
  const messages = normalized([
    { role: 'assistant', content: [null, '  ', {}, { type: 'text' }, { text: null }] },
    { role: 'user', content: 'next' },
  ]);

  expect(messages).toEqual([{ role: 'user', content: 'next' }]);
});

test('keeps an assistant whose content parts carry something unreadable', () => {
  const messages = normalized([
    { role: 'assistant', content: [7] },
    { role: 'assistant', content: [{ text: 7 }] },
    { role: 'assistant', content: ['visible'] },
    { role: 'assistant', content: 7 },
  ]);

  expect(messages).toHaveLength(4);
});

test('borrows the assistant text as reasoning when the turn calls a tool', () => {
  const messages = normalized([assistantCall('call_1', { content: '  thinking out loud  ' })]);

  expect(messages).toHaveProperty('0.reasoning_content', 'thinking out loud');
});

test('joins the readable assistant parts into the borrowed reasoning', () => {
  const messages = normalized([
    assistantCall('call_1', { content: [{ text: ' one ' }, 5, { text: '  ' }, { text: 'two' }] }),
  ]);

  expect(messages).toHaveProperty('0.reasoning_content', 'one\ntwo');
});

test('says the reasoning is unavailable when the turn carries no readable text', () => {
  const messages = normalized([assistantCall('call_1', { content: [] })]);

  expect(messages).toHaveProperty('0.reasoning_content', '[reasoning unavailable]');
});

test('keeps a tool result that answers a call this history never opened', () => {
  const messages = normalized([{ role: 'tool', tool_call_id: 'call_absent', content: 'result' }]);

  expect(messages).toEqual([{ role: 'tool', tool_call_id: 'call_absent', content: 'result' }]);
});

test('leaves a tool call that names no identifier out of the pending links', () => {
  const messages = normalized([
    { role: 'assistant', content: 'calling', tool_calls: [{ type: 'function', function: {} }] },
    { role: 'tool', content: 'result' },
  ]);

  expect(messages).toEqual([
    { role: 'assistant', content: 'calling', tool_calls: [{ type: 'function', function: {} }] },
    { role: 'tool', content: 'result' },
  ]);
});
