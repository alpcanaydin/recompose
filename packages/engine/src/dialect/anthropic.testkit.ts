import type {
  AnthropicRequest,
  AnthropicResponse,
  AnthropicStreamEvent,
  AnthropicTool,
} from './anthropic-wire';
import type { TranslateResult, Translated } from './fates';
import type { HubRequest } from './hub';

import { decodeRequest } from './anthropic-request';

export function decodedValue(request: AnthropicRequest): Translated<HubRequest> {
  const result: TranslateResult<HubRequest, unknown> = decodeRequest(request);

  if ('refusal' in result) {
    throw new Error(`expected a decoded hub request: ${JSON.stringify(result)}`);
  }

  return result;
}

export function anAnthropicTool(overrides: Partial<AnthropicTool> = {}): AnthropicTool {
  return {
    name: 'get_weather',
    description: 'Look up the weather for a city',
    input_schema: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
    },
    ...overrides,
  };
}

export function anAnthropicAsk(overrides: Partial<AnthropicRequest> = {}): AnthropicRequest {
  return {
    model: 'claude-sonnet',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
    ...overrides,
  };
}

export function anAnthropicAnswer(overrides: Partial<AnthropicResponse> = {}): AnthropicResponse {
  return {
    id: 'msg_01',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Sunny, 21C.' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 12, output_tokens: 8 },
    ...overrides,
  };
}

export function anAnthropicWireTextStream(): readonly AnthropicStreamEvent[] {
  return [
    { type: 'message_start', message: anAnthropicAnswer({ content: [], stop_reason: null }) },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'ping' },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hel' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'lo' } },
    { type: 'content_block_stop', index: 0 },
    {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { input_tokens: 12, output_tokens: 15 },
    },
    { type: 'message_stop' },
  ];
}
