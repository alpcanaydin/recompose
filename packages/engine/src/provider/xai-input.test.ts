import { describe, expect, test } from 'vitest';

import { normalizeXAIInput } from './xai-input';

function validEncryptedContent(seed = 7): string {
  return Buffer.alloc(256, seed).toString('base64').replace(/=+$/u, '');
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
