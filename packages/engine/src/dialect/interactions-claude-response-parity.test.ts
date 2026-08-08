import { describe, expect, it } from 'vitest';

import type { AnthropicStreamEvent } from './anthropic-wire';
import type { InteractionsStreamEvent } from './interactions-wire';

import { decodeStream as decodeAnthropicStream } from './anthropic-stream';
import { translateResponse, translateStream } from './dispatcher';
import { collectHubResponse } from './hub-stream-response';
import { encodeResponse as encodeInteractionsResponse } from './interactions-response';

describe('Interactions non-stream answers crossing Claude', () => {
  it('should preserve text, tool calls, identity, and usage', () => {
    const translated = translateResponse('interactions', 'anthropic', {
      id: 'interaction_1',
      model: 'claude-test',
      status: 'requires_action',
      steps: [
        { type: 'model_output', content: [{ type: 'text', text: 'ok' }] },
        { type: 'function_call', id: 'call_1', name: 'lookup', arguments: { q: 'x' } },
      ],
      usage: { total_input_tokens: 3, total_output_tokens: 2, total_tokens: 5 },
    });

    if ('outcome' in translated || 'refusal' in translated) {
      throw new Error('expected translated response');
    }

    expect(translated.value).toMatchObject({
      id: 'interaction_1',
      model: 'claude-test',
      content: [
        { type: 'text', text: 'ok' },
        { type: 'tool_use', id: 'call_1', name: 'lookup', input: { q: 'x' } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 3, output_tokens: 2 },
    });
  });
});

describe('Interactions text streams crossing Claude', () => {
  it('should preserve message identity, text, finish, and usage', async () => {
    const events = await interactionsToClaude([
      {
        event_type: 'interaction.created',
        interaction: { id: 'interaction_1', model: 'claude-test', status: 'created' },
      },
      { event_type: 'step.start', index: 0, step: { type: 'model_output', content: [] } },
      { event_type: 'step.delta', index: 0, delta: { type: 'text', text: 'hello' } },
      { event_type: 'step.stop', index: 0 },
      {
        event_type: 'interaction.completed',
        interaction: {
          id: 'interaction_1',
          model: 'claude-test',
          status: 'completed',
          usage: { total_input_tokens: 3, total_output_tokens: 4 },
        },
      },
    ]);

    const start = events.find((event) => event.type === 'message_start');
    const finish = events.find((event) => event.type === 'message_delta');

    expect(start).toHaveProperty('message.id', 'interaction_1');
    expect(start).toHaveProperty('message.model', 'claude-test');
    expect(events).toContainEqual({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'hello' },
    });
    expect(finish).toHaveProperty('usage.output_tokens', 4);
    expect(events.at(-1)).toEqual({ type: 'message_stop' });
  });
});

describe('Interactions tool streams crossing Claude', () => {
  it('should preserve tool identity, arguments, and tool-use finish', async () => {
    const events = await interactionsToClaude([
      {
        event_type: 'step.start',
        index: 0,
        step: { type: 'function_call', id: 'call_1', name: 'lookup', arguments: {} },
      },
      {
        event_type: 'step.delta',
        index: 0,
        delta: { type: 'arguments_delta', arguments: '{"q":"x"}' },
      },
      { event_type: 'step.stop', index: 0 },
      {
        event_type: 'interaction.completed',
        interaction: { id: 'interaction_1', status: 'requires_action' },
      },
    ]);

    const start = events.find((event) => event.type === 'content_block_start');
    const finish = events.find((event) => event.type === 'message_delta');

    expect(start).toHaveProperty('content_block.id', 'call_1');
    expect(start).toHaveProperty('content_block.name', 'lookup');
    expect(events).toContainEqual({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'input_json_delta', partial_json: '{"q":"x"}' },
    });
    expect(finish).toHaveProperty('delta.stop_reason', 'tool_use');
  });
});

describe('Claude streams crossing Interactions', () => {
  it('should merge opening and closing usage into one completed interaction', async () => {
    const events = await claudeToInteractions(claudeTextStream());
    const completed = events.find((event) => event.event_type === 'interaction.completed');

    expect(events.some((event) => event.event_type === 'interaction.status_update')).toBe(true);
    expect(completed).toHaveProperty('interaction.usage', {
      input_tokens: 3,
      total_input_tokens: 3,
      prompt_tokens: 3,
      output_tokens: 2,
      total_output_tokens: 2,
      completion_tokens: 2,
      total_tokens: 5,
    });
  });
});

describe('Claude SSE collected as a non-stream Interactions answer', () => {
  it('should synthesize content and total usage from stream events', async () => {
    const hub = await collectHubResponse(decodeAnthropicStream(streamOf(claudeTextStream())));

    if (hub === null) throw new Error('expected collected Hub response');

    const response = encodeInteractionsResponse(hub).value;

    expect(response).toHaveProperty('steps.0.content.0.text', 'ok');
    expect(response).toHaveProperty('usage.total_tokens', 5);
  });
});

function claudeTextStream(): readonly AnthropicStreamEvent[] {
  return [
    {
      type: 'message_start',
      message: {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 3, output_tokens: 0 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
    { type: 'content_block_stop', index: 0 },
    {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 2 },
    },
    { type: 'message_stop' },
  ];
}

async function interactionsToClaude(source: readonly InteractionsStreamEvent[]) {
  const translated = translateStream('interactions', 'anthropic', streamOf(source));

  if ('outcome' in translated) throw new Error('expected translated stream');

  const events = [];

  for await (const event of translated.stream) events.push(event);

  return events;
}

async function claudeToInteractions(source: readonly AnthropicStreamEvent[]) {
  const translated = translateStream('anthropic', 'interactions', streamOf(source));

  if ('outcome' in translated) throw new Error('expected translated stream');

  const events = [];

  for await (const event of translated.stream) events.push(event);

  return events;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
