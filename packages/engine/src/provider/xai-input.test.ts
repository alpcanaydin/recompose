import { describe, expect, test } from 'vitest';

import { normalizeXAIInput } from './xai-input';

function validEncryptedContent(seed = 7): string {
  return Buffer.from(
    Array.from({ length: 256 }, (_value, index) => (index * 41 + seed * 67 + 17) % 251),
  )
    .toString('base64')
    .replace(/=+$/u, '');
}

describe('xAI agent messages', () => {
  test('rewrites Codex agent messages and decryptable content to user input text', () => {
    const body = normalizeXAIInput({
      input: [
        {
          type: 'agent_message',
          id: 'amsg_1',
          author: '/root',
          recipient: '/root/worker',
          content: [
            { type: 'input_text', text: 'Task:' },
            { type: 'encrypted_content', encrypted_content: 'do the work' },
          ],
          internal_chat_message_metadata_passthrough: { turn_id: 'turn-1' },
        },
      ],
    });

    expect(body).toHaveProperty('input.0', {
      type: 'message',
      role: 'user',
      id: 'amsg_1',
      author: '/root',
      recipient: '/root/worker',
      content: [
        { type: 'input_text', text: 'Task:' },
        { type: 'input_text', text: 'do the work' },
      ],
      internal_chat_message_metadata_passthrough: { turn_id: 'turn-1' },
    });
  });
});

const customHistoryInput = [
  { type: 'message', role: 'user', content: 'search' },
  { type: 'custom_tool_call', name: 'missing_call_id', input: 'invalid' },
  { type: 'custom_tool_call_output', output: 'missing call id' },
  {
    type: 'custom_tool_call',
    call_id: 'xs_call-1',
    name: 'x_semantic_search',
    input: '{"query":"US stocks","limit":"10"}',
  },
  {
    type: 'custom_tool_call_output',
    call_id: 'xs_call-1',
    output: 'unsupported custom tool call: x_semantic_search',
  },
  { type: 'custom_tool_call', call_id: 'call-2', name: 'apply_patch', input: 'patch' },
  {
    type: 'custom_tool_call_output',
    call_id: 'call-2',
    output: [{ type: 'input_text', text: 'done' }],
  },
];

const expectedCustomHistory = [
  { type: 'message', role: 'user', content: 'search' },
  {
    type: 'function_call',
    call_id: 'xs_call-1',
    name: 'x_semantic_search',
    arguments: '{"query":"US stocks","limit":"10"}',
  },
  {
    type: 'function_call_output',
    call_id: 'xs_call-1',
    output: 'unsupported custom tool call: x_semantic_search',
  },
  {
    type: 'function_call',
    call_id: 'call-2',
    name: 'apply_patch',
    arguments: '{"input":"patch"}',
  },
  {
    type: 'function_call_output',
    call_id: 'call-2',
    output: '[{"type":"input_text","text":"done"}]',
  },
];

test('drops malformed xAI calls and converts supported custom history', () => {
  expect(normalizeXAIInput({ input: customHistoryInput })['input']).toEqual(expectedCustomHistory);
});

describe('xAI encrypted reasoning', () => {
  test('removes invalid reasoning blobs and preserves valid Grok content', () => {
    const valid = validEncryptedContent();
    const body = normalizeXAIInput({
      input: [
        { type: 'reasoning', summary: [], encrypted_content: 'bad' },
        { type: 'reasoning', summary: [], encrypted_content: 'gAAAAABinvalid-gpt-shape' },
        { type: 'reasoning', summary: [], encrypted_content: valid },
      ],
    });

    expect(body).not.toHaveProperty('input.0.encrypted_content');
    expect(body).toHaveProperty('input.1.encrypted_content', valid);
  });

  test('re-merges adjacent reasoning summaries after invalid content removal', () => {
    const body = normalizeXAIInput({
      input: [
        { type: 'reasoning', summary: [{ type: 'summary_text', text: 'first' }] },
        {
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: 'second' }],
          encrypted_content: 'foreign-replay',
        },
        { role: 'user', content: 'hi' },
      ],
    });

    expect(body['input']).toEqual([
      {
        type: 'reasoning',
        summary: [
          { type: 'summary_text', text: 'first' },
          { type: 'summary_text', text: 'second' },
        ],
      },
      { role: 'user', content: 'hi' },
    ]);
  });

  test('drops compaction items carrying invalid encrypted content', () => {
    const body = normalizeXAIInput({
      input: [
        { type: 'compaction', encrypted_content: 'foreign-replay' },
        { role: 'user', content: 'hi' },
      ],
    });

    expect(body['input']).toEqual([{ role: 'user', content: 'hi' }]);
  });
});

describe('xAI reasoning hygiene', () => {
  test('keeps compaction items carrying sound encrypted content', () => {
    const valid = validEncryptedContent(3);
    const body = normalizeXAIInput({ input: [{ type: 'compaction', encrypted_content: valid }] });

    expect(body).toHaveProperty('input.0', { type: 'compaction', encrypted_content: valid });
  });

  test('removes the null content field a reasoning item arrives with', () => {
    const valid = validEncryptedContent(5);
    const body = normalizeXAIInput({
      input: [{ type: 'reasoning', content: null, encrypted_content: valid }],
    });

    expect(body).toHaveProperty('input.0', { type: 'reasoning', encrypted_content: valid });
  });

  test('merges reasoning that arrived without a summary list', () => {
    const body = normalizeXAIInput({
      input: [
        { type: 'reasoning' },
        { type: 'reasoning', summary: [{ type: 'summary_text', text: 'second' }] },
      ],
    });

    expect(body['input']).toEqual([
      { type: 'reasoning', summary: [{ type: 'summary_text', text: 'second' }] },
    ]);
  });
});

describe('xAI input entries the gateway leaves alone', () => {
  test('entries that are not objects travel through untouched', () => {
    expect(normalizeXAIInput({ input: ['raw entry', 7] })['input']).toEqual(['raw entry', 7]);
  });

  test('a body without an input list is left as it stands', () => {
    expect(normalizeXAIInput({ model: 'grok-5' })).toEqual({ model: 'grok-5' });
  });

  test('an agent message whose content is not a list keeps that content', () => {
    const body = normalizeXAIInput({ input: [{ type: 'agent_message', content: 'plain brief' }] });

    expect(body['input']).toEqual([{ type: 'message', role: 'user', content: 'plain brief' }]);
  });

  test('an encrypted part carrying no text becomes empty input text', () => {
    const body = normalizeXAIInput({
      input: [{ type: 'agent_message', content: [{ type: 'encrypted_content' }] }],
    });

    expect(body).toHaveProperty('input.0.content', [{ type: 'input_text', text: '' }]);
  });
});

describe('xAI custom tool arguments', () => {
  test('a call arriving without arguments sends an empty object', () => {
    const body = normalizeXAIInput({
      input: [{ type: 'custom_tool_call', call_id: 'c1', name: 'apply_patch' }],
    });

    expect(body).toHaveProperty('input.0.arguments', '{}');
  });

  test('arguments that do not describe an object are wrapped under an input key', () => {
    const body = normalizeXAIInput({
      input: [
        { type: 'custom_tool_call', call_id: 'c1', name: 'a', input: '123' },
        { type: 'custom_tool_call', call_id: 'c2', name: 'b', input: 7 },
        { type: 'custom_tool_call', call_id: 'c3', name: 'c', input: { q: 1 } },
      ],
    });

    expect(body).toHaveProperty('input.0.arguments', '{"input":"123"}');
    expect(body).toHaveProperty('input.1.arguments', '{"input":7}');
    expect(body).toHaveProperty('input.2.arguments', '{"q":1}');
  });

  test('a call without a usable tool name is dropped', () => {
    const body = normalizeXAIInput({
      input: [{ type: 'custom_tool_call', call_id: 'c1', name: '   ' }],
    });

    expect(body['input']).toEqual([]);
  });

  test('an output arriving without a result sends empty text', () => {
    const body = normalizeXAIInput({ input: [{ type: 'custom_tool_call_output', call_id: 'c1' }] });

    expect(body).toHaveProperty('input.0.output', '');
  });
});
