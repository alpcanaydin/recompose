import { describe, expect, it } from 'vitest';

import type { AnthropicResponse } from './anthropic-wire';
import type { TranslateResult, Translated } from './fates';
import type { HubResponse } from './hub';

import { decodeResponse, encodeResponse } from './anthropic-response';
import { anAnthropicAnswer } from './anthropic.testkit';
import { aHubResponse } from './hub.testkit';

function encodedValue(hub: HubResponse): Translated<AnthropicResponse> {
  const result: TranslateResult<AnthropicResponse, unknown> = encodeResponse(hub);

  if ('refusal' in result) {
    throw new Error(`expected an encoded wire response: ${JSON.stringify(result)}`);
  }

  return result;
}

describe('encodeResponse writes a hub answer as the wire message envelope', () => {
  it('wraps the content in the full wire envelope with an empty ledger', () => {
    const { value, fates } = encodedValue(
      aHubResponse({
        content: [{ type: 'text', text: 'Sunny, 21C.' }],
        stopReason: 'end',
        usage: { inputTokens: 12, outputTokens: 8 },
      }),
    );

    expect(value).toStrictEqual({
      id: 'msg_translated',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Sunny, 21C.' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 12, output_tokens: 8 },
    });
    expect(fates).toStrictEqual([]);
  });

  it.each([
    ['end', 'end_turn'],
    ['max_output', 'max_tokens'],
    ['stop_sequence', 'stop_sequence'],
    ['tool_use', 'tool_use'],
    ['paused', 'pause_turn'],
    ['refusal', 'refusal'],
    ['context_overflow', 'model_context_window_exceeded'],
  ] as const)('writes the hub stop reason %s as the wire %s', (hub, wire) => {
    const { value } = encodedValue(aHubResponse({ stopReason: hub }));

    expect(value.stop_reason).toBe(wire);
  });
});

describe('encodeResponse writes the usage and the content blocks', () => {
  it('writes the cache token counts under their wire names', () => {
    const { value } = encodedValue(
      aHubResponse({
        usage: { inputTokens: 12, outputTokens: 8, cacheReadTokens: 3, cacheWriteTokens: 5 },
      }),
    );

    expect(value.usage).toEqual({
      input_tokens: 12,
      output_tokens: 8,
      cache_read_input_tokens: 3,
      cache_creation_input_tokens: 5,
    });
  });

  it('writes hub thinking and tool_use blocks in their wire shapes', () => {
    const { value } = encodedValue(
      aHubResponse({
        content: [
          { type: 'thinking', text: 'weigh the routes', signature: 'sig-40d1' },
          { type: 'redacted_thinking', data: 'opaque-payload' },
          { type: 'tool_use', id: 'toolu_01', name: 'get_weather', input: { city: 'Paris' } },
        ],
      }),
    );

    expect(value.content).toEqual([
      { type: 'thinking', thinking: 'weigh the routes', signature: 'sig-40d1' },
      { type: 'redacted_thinking', data: 'opaque-payload' },
      { type: 'tool_use', id: 'toolu_01', name: 'get_weather', input: { city: 'Paris' } },
    ]);
  });
});

describe('decodeResponse reads a wire message into the hub answer', () => {
  it('reads content, stop reason, and usage including the cache counts', () => {
    const { value } = decodeResponse(
      anAnthropicAnswer({
        usage: {
          input_tokens: 12,
          output_tokens: 8,
          cache_read_input_tokens: 3,
          cache_creation_input_tokens: 5,
        },
      }),
    );

    expect(value).toStrictEqual({
      content: [{ type: 'text', text: 'Sunny, 21C.' }],
      stopReason: 'end',
      usage: { inputTokens: 12, outputTokens: 8, cacheReadTokens: 3, cacheWriteTokens: 5 },
    });
  });

  it('reads a usage naming no cache counts without inventing them', () => {
    const { value } = decodeResponse(anAnthropicAnswer());

    expect(value.usage).toStrictEqual({ inputTokens: 12, outputTokens: 8 });
  });
});

describe('decodeResponse reads every wire stop reason', () => {
  it.each([
    ['end_turn', 'end'],
    ['max_tokens', 'max_output'],
    ['stop_sequence', 'stop_sequence'],
    ['tool_use', 'tool_use'],
    ['pause_turn', 'paused'],
    ['refusal', 'refusal'],
    ['model_context_window_exceeded', 'context_overflow'],
  ] as const)('reads the wire stop reason %s as the hub %s', (wire, hub) => {
    const { value } = decodeResponse(anAnthropicAnswer({ stop_reason: wire }));

    expect(value.stopReason).toBe(hub);
  });

  it('reads an unknown stop reason as a plain end', () => {
    const { value } = decodeResponse(anAnthropicAnswer({ stop_reason: 'a_future_reason' }));

    expect(value.stopReason).toBe('end');
  });

  it('reads a null stop reason as a plain end', () => {
    const { value } = decodeResponse(anAnthropicAnswer({ stop_reason: null }));

    expect(value.stopReason).toBe('end');
  });

  it('notes a matched stop sequence the hub cannot carry', () => {
    const { fates } = decodeResponse(anAnthropicAnswer({ stop_sequence: '\n\n' }));

    expect(fates).toContainEqual({ field: 'stop_sequence', disposition: 'mapped', to: 'absent' });
  });

  it('records an empty ledger for a plain answer', () => {
    const { fates } = decodeResponse(anAnthropicAnswer());

    expect(fates).toEqual([]);
  });

  it('records an empty ledger for an answer naming no stop_sequence at all', () => {
    const { fates } = decodeResponse({
      id: 'msg_01',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Sunny, 21C.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 12, output_tokens: 8 },
    });

    expect(fates).toEqual([]);
  });
});

describe('encodeResponse and decodeResponse settle the cache counts', () => {
  it('writes a usage naming no cache counts without inventing them', () => {
    const { value } = encodedValue(aHubResponse({ usage: { inputTokens: 12, outputTokens: 8 } }));

    expect(value.usage).toStrictEqual({ input_tokens: 12, output_tokens: 8 });
  });
});
