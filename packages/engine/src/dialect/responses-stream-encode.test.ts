import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';

import { encodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import { aHubStreamOfAToolCall } from './hub.testkit';
import { encodeStream } from './responses-codec';
import { collect, streamOf } from './responses.testkit';

const signature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';

async function encode(events: readonly HubStreamEvent[]) {
  return collect(encodeStream(streamOf(events)));
}

describe('encodeStream: hub events fold back out to Responses events', () => {
  it('adds a function_call output item carrying the tool name and id', async () => {
    const events = await encode(aHubStreamOfAToolCall());

    expect(events).toContainEqual({
      type: 'response.output_item.added',
      output_index: 0,
      item: {
        type: 'function_call',
        id: 'toolu_weather',
        call_id: 'toolu_weather',
        name: 'get_weather',
      },
    });
  });

  it('streams the tool arguments through a function-call arguments delta', async () => {
    const events = await encode(aHubStreamOfAToolCall());

    expect(events).toContainEqual({
      type: 'response.function_call_arguments.delta',
      output_index: 0,
      delta: '{"city":"Paris"}',
    });
  });
});

describe('encodeStream: the whole tool-call stream folds event for event', () => {
  it('folds the hub tool-call stream into the Responses event sequence', async () => {
    const events = await encode(aHubStreamOfAToolCall());
    const completedCall = {
      type: 'function_call',
      call_id: 'toolu_weather',
      name: 'get_weather',
      arguments: '{"city":"Paris"}',
    };

    expect(events).toEqual([
      {
        type: 'response.created',
        response: { id: 'resp_translated', status: 'in_progress', output: [] },
      },
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: {
          type: 'function_call',
          id: 'toolu_weather',
          call_id: 'toolu_weather',
          name: 'get_weather',
        },
      },
      {
        type: 'response.function_call_arguments.delta',
        output_index: 0,
        delta: '{"city":"Paris"}',
      },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: { ...completedCall, id: 'toolu_weather' },
      },
      {
        type: 'response.completed',
        response: {
          id: 'resp_translated',
          status: 'completed',
          output: [completedCall],
          usage: { input_tokens: 12, output_tokens: 8 },
        },
      },
    ]);
  });
});

describe('encodeStream: Gemini tool signatures cross as Responses carriers', () => {
  it('emits the carrier before the function call and retains both terminal items', async () => {
    const events = await encode([
      { type: 'message-begin' },
      {
        type: 'block-open',
        index: 0,
        opening: { kind: 'tool', id: 'native-call', name: 'run', signature },
      },
      { type: 'block-delta', index: 0, delta: { kind: 'json-args', partialJson: '{}' } },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'tool_use', usage: {} },
    ]);
    const encryptedContent = encodeGeminiResponsesCarrier({
      signature,
      direction: 'next',
      target: 'function',
    });
    const carrier = {
      type: 'reasoning',
      id: 'rs_stream_0',
      summary: [],
      content: null,
      encrypted_content: encryptedContent,
    };

    expect(events).toContainEqual({
      type: 'response.output_item.added',
      output_index: 0,
      item: carrier,
    });
    expect(events).toContainEqual({
      type: 'response.output_item.done',
      output_index: 0,
      item: carrier,
    });
    expect(events).toContainEqual({
      type: 'response.output_item.added',
      output_index: 1,
      item: { type: 'function_call', id: 'native-call', call_id: 'native-call', name: 'run' },
    });
    expect(events).toHaveProperty('5.item.arguments', '{}');
    expect(events).toHaveProperty('6.response.output.0.encrypted_content', encryptedContent);
    expect(events).toHaveProperty('6.response.output.1.arguments', '{}');
  });
});

describe('encodeStream: unsafe Gemini tool signatures', () => {
  it('does not expose bypass or malformed signatures as carriers', async () => {
    const events = await encode([
      {
        type: 'block-open',
        index: 0,
        opening: {
          kind: 'tool',
          id: 'call_a',
          name: 'run',
          signature: 'skip_thought_signature_validator',
        },
      },
      { type: 'block-close', index: 0 },
      {
        type: 'block-open',
        index: 1,
        opening: { kind: 'tool', id: 'call_b', name: 'run', signature: 'not-native' },
      },
      { type: 'block-close', index: 1 },
    ]);

    expect(events.filter((event) => event.type === 'response.output_item.added')).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain('cpa-gemini-responses-carrier-v1:');
  });
});

describe('encodeStream: openings and terminators cross to Responses', () => {
  it('adds a message output item for a text block open', async () => {
    const events = await encode([{ type: 'block-open', index: 0, opening: { kind: 'text' } }]);

    expect(events).toEqual([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'message', role: 'assistant' },
      },
    ]);
  });

  it('ends a truncated answer on a response.incomplete event', async () => {
    const events = await encode([
      { type: 'message-end', stopReason: 'max_output', usage: { outputTokens: 9 } },
    ]);

    expect(events).toEqual([
      {
        type: 'response.incomplete',
        response: {
          id: 'resp_translated',
          status: 'incomplete',
          output: [],
          incomplete_details: { reason: 'max_output_tokens' },
          usage: { output_tokens: 9 },
        },
      },
    ]);
  });

  it('adds a reasoning item for a thinking block and streams its text as a summary delta', async () => {
    const events = await encode([
      { type: 'block-open', index: 0, opening: { kind: 'thinking' } },
      { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'ponder' } },
      { type: 'block-delta', index: 0, delta: { kind: 'signature', signature: 'sig' } },
      { type: 'block-close', index: 0 },
    ]);

    expect(events).toContainEqual({
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'reasoning', id: 'rs_stream_0' },
    });
    expect(events).toContainEqual({
      type: 'response.reasoning_summary_text.delta',
      output_index: 0,
      delta: 'ponder',
    });
    expect(events.some((event) => event.type === 'response.output_text.delta')).toBe(false);
  });
});

describe('encodeStream: a failure crosses as an error event', () => {
  it('maps a hub stream error to a Responses error event', async () => {
    const events = await encode([
      { type: 'stream-error', error: { type: 'overloaded_error', message: 'slow down' } },
    ]);

    expect(events).toEqual([{ type: 'error', code: 'overloaded_error', message: 'slow down' }]);
  });

  it('stops after a stream error and encodes no later hub event', async () => {
    const events = await encode([
      { type: 'stream-error', error: { type: 'overloaded_error', message: 'slow down' } },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
    ]);

    expect(events).toEqual([{ type: 'error', code: 'overloaded_error', message: 'slow down' }]);
  });

  it('maps a message-end with an unmappable stop reason to an error event', async () => {
    const events = await encode([
      { type: 'message-end', stopReason: 'paused', usage: { inputTokens: 3 } },
    ]);

    expect(events).toEqual([{ type: 'error', code: 'unmappable_stop_reason', message: 'paused' }]);
  });
});
