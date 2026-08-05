import { describe, expect, it } from 'vitest';

import type { ChatStreamFrame } from './chat-completions-wire';
import type { HubStreamEvent } from './hub';

import { encodeStream } from './chat-completions-stream';
import { collect, streamOf } from './chat-completions.testkit';
import { aHubStreamOfAToolCall } from './hub.testkit';

describe('encodeStream renders text, reasoning drops, and refusals', () => {
  it('renders a text delta and drops the thinking and signature deltas', async () => {
    const events: readonly HubStreamEvent[] = [
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'hi' } },
      { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'hmm' } },
      { type: 'block-delta', index: 0, delta: { kind: 'signature', signature: 'sig' } },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ];

    const frames = await collect(encodeStream(streamOf(events)));

    expect(JSON.stringify(frames)).toContain('"content":"hi"');
    expect(frames).toContainEqual({
      type: 'chunk',
      chunk: { choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } },
    });
    expect(frames.at(-1)).toEqual({ type: 'done' });
  });

  it('emits a tool args chunk even when no block open preceded it', async () => {
    const events: readonly HubStreamEvent[] = [
      { type: 'message-begin' },
      { type: 'block-delta', index: 7, delta: { kind: 'json-args', partialJson: '{"a":1}' } },
      { type: 'message-end', stopReason: 'tool_use', usage: {} },
    ];

    const frames = await collect(encodeStream(streamOf(events)));

    expect(frames).toContainEqual({
      type: 'chunk',
      chunk: {
        choices: [
          {
            index: 0,
            delta: { tool_calls: [{ index: 0, function: { arguments: '{"a":1}' } }] },
            finish_reason: null,
          },
        ],
      },
    });
  });

  it('carries an unmappable stop reason as an error frame, not a terminator', async () => {
    const events: readonly HubStreamEvent[] = [
      { type: 'message-begin' },
      { type: 'message-end', stopReason: 'paused', usage: {} },
    ];

    const frames = await collect(encodeStream(streamOf(events)));

    expect(frames.at(-1)?.type).toBe('error');
    expect(frames.some((frame) => frame.type === 'done')).toBe(false);
  });
});

describe('encodeStream folds hub events back into Chat Completions frames', () => {
  it('ends a clean stream in the Chat Completions terminator', async () => {
    const frames = await collect(encodeStream(streamOf(aHubStreamOfAToolCall())));

    expect(frames.at(-1)).toEqual({ type: 'done' });
    expect(frames.some((frame) => frame.type === 'error')).toBe(false);
  });

  it('carries a mid-stream failure as an error frame with no terminator after it', async () => {
    const events: readonly HubStreamEvent[] = [
      { type: 'message-begin' },
      { type: 'stream-error', error: { type: 'overloaded_error', message: 'Overloaded' } },
    ];

    const frames = await collect(encodeStream(streamOf(events)));

    expect(frames.at(-1)).toEqual({
      type: 'error',
      error: { type: 'overloaded_error', message: 'Overloaded' },
    });
    expect(frames.some((frame) => frame.type === 'done')).toBe(false);
  });
});

const expectedChatToolFrames: readonly ChatStreamFrame[] = [
  {
    type: 'chunk',
    chunk: { choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] },
  },
  {
    type: 'chunk',
    chunk: {
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              { index: 0, id: 'toolu_weather', function: { name: 'get_weather', arguments: '' } },
            ],
          },
          finish_reason: null,
        },
      ],
    },
  },
  {
    type: 'chunk',
    chunk: {
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":"Paris"}' } }] },
          finish_reason: null,
        },
      ],
    },
  },
  { type: 'chunk', chunk: { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] } },
  { type: 'chunk', chunk: { choices: [], usage: { prompt_tokens: 12, completion_tokens: 8 } } },
  { type: 'done' },
];

describe('encodeStream folds the hub stream into exact Chat Completions frames', () => {
  it('encodes the hub tool stream frame for frame', async () => {
    const frames = await collect(encodeStream(streamOf(aHubStreamOfAToolCall())));

    expect(frames).toEqual(expectedChatToolFrames);
  });
});
