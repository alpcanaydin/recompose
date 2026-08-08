import { expect } from 'vitest';

import type { AnthropicKnownStreamEvent, AnthropicStreamEvent } from './anthropic-wire';
import type {
  ResponsesFunctionCallItem,
  ResponsesResponse,
  ResponsesStreamEvent,
} from './responses-wire';

import { collect, streamOf } from './chat-completions.testkit';
import { translateResponse, translateStream } from './dispatcher';

export async function probeReasoningLifecycle(): Promise<void> {
  const events = await stream([
    created(),
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'reasoning', encrypted_content: 'early' },
    },
    { type: 'response.reasoning_summary_text.delta', output_index: 0, delta: 'part one' },
    { type: 'response.reasoning_summary_text.delta', output_index: 0, delta: ' part two' },
    {
      type: 'response.output_item.done',
      output_index: 0,
      item: { type: 'reasoning', encrypted_content: 'final' },
    },
    {
      type: 'response.output_item.done',
      output_index: 1,
      item: { type: 'reasoning', encrypted_content: 'only' },
    },
    completed([]),
  ]);
  const starts = events.filter(isContentStart);
  const signatures = events.flatMap(signatureDelta);

  expect(starts.map((event) => event.content_block.type)).toEqual(['thinking', 'thinking']);
  expect(signatures).toEqual(['final', 'only']);
  expect(events[0]).toHaveProperty('message.id', 'resp_1');
}

export async function probeParallelCalls(): Promise<void> {
  const events = await stream([
    created(),
    callAdded(0, 'call_a', 'Read'),
    callAdded(1, 'call_b', 'Read'),
    { type: 'response.function_call_arguments.delta', output_index: 1, delta: '{"path":"b"}' },
    { type: 'response.output_text.delta', output_index: 2, delta: 'done' },
    completed([
      callItem('call_a', 'Read', '{"path":"a"}'),
      callItem('call_b', 'Read', '{"path":"b"}'),
    ]),
  ]);
  const starts = events.filter(isContentStart);
  const stops = events.filter((event) => event.type === 'content_block_stop');

  expect(starts.map((event) => event.content_block.type)).toEqual(['tool_use', 'tool_use', 'text']);
  expect(stops).toHaveLength(starts.length);
  expect(messageStop(events)).toBe('tool_use');
}

export async function probePendingCalls(): Promise<void> {
  const events = await stream([
    created(),
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'function_call', call_id: 'call_a' },
    },
    {
      type: 'response.output_item.added',
      output_index: 1,
      item: { type: 'message', role: 'assistant' },
    },
    { type: 'response.output_text.delta', output_index: 1, delta: 'text first' },
    completed([callItem('call_a', 'Read', '{"path":"a"}')]),
  ]);
  const starts = events.filter(isContentStart);

  expect(starts.map((event) => event.content_block.type)).toEqual(['text', 'tool_use']);
  expect(starts[1]).toHaveProperty('content_block.id', 'call_a');
}

export async function probeFallbackText(): Promise<void> {
  const events = await stream([
    created(),
    {
      type: 'response.output_item.done',
      output_index: 0,
      item: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'fallback' }],
      },
    },
    completed([]),
  ]);

  expect(events.flatMap(textDelta)).toEqual(['fallback']);
}

export async function probeWebSearch(): Promise<void> {
  const source = webSearchResponse();
  const nonStream = translateResponse('responses', 'anthropic', source);

  if ('outcome' in nonStream || 'refusal' in nonStream) throw new Error('expected response');

  const events = await stream([
    created(),
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'web_search_call', id: 'ws_1' },
    },
    { type: 'response.output_item.done', output_index: 0, item: source.output[0] },
    completed([]),
  ]);

  expect(nonStream.value.content.map((block) => block.type)).toEqual([
    'server_tool_use',
    'web_search_tool_result',
    'text',
  ]);
  expect(nonStream.value.stop_reason).toBe('end_turn');
  expect(contentStartTypes(events)).toEqual(['server_tool_use', 'web_search_tool_result']);
}

export async function probeLongToolIds(): Promise<void> {
  const id = `call_${'x'.repeat(100)}`;
  const response: ResponsesResponse = {
    id: 'resp_1',
    status: 'completed',
    output: [callItem(id, 'lookup', '{}')],
  };
  const translated = translateResponse('responses', 'anthropic', response);

  if ('outcome' in translated || 'refusal' in translated) throw new Error('expected response');

  const events = await stream([created(), callAdded(0, id, 'lookup'), completed(response.output)]);

  expect(translated.value.content[0]).toHaveProperty('id', expect.stringMatching(/^.{64}$/u));
  expect(events.find((event) => event.type === 'content_block_start')).toHaveProperty(
    'content_block.id',
    expect.stringMatching(/^.{64}$/u),
  );
}

export async function probeStopMapping(): Promise<void> {
  const max = translatedResponse({
    id: 'r',
    status: 'incomplete',
    output: [],
    incomplete_details: { reason: 'max_output_tokens' },
  });
  const refusal = translatedResponse({
    id: 'r',
    status: 'incomplete',
    output: [],
    incomplete_details: { reason: 'content_filter' },
  });
  const sequence = translatedResponse({
    id: 'r',
    status: 'completed',
    output: [],
    stop_sequence: '\nEND',
  });
  const events = await stream([
    {
      type: 'response.completed',
      response: { id: 'r', status: 'completed', output: [], stop_sequence: '\nEND' },
    },
  ]);

  expect(max.stop_reason).toBe('max_tokens');
  expect(refusal.stop_reason).toBe('refusal');
  expect(sequence).toMatchObject({ stop_reason: 'stop_sequence', stop_sequence: '\nEND' });
  expect(events.find((event) => event.type === 'message_delta')).toHaveProperty('delta', {
    stop_reason: 'stop_sequence',
    stop_sequence: '\nEND',
  });
}

export async function probeErrorMapping(): Promise<void> {
  const events = await stream([
    {
      type: 'error',
      error: { type: 'invalid_request_error', code: 'cyber_policy_violation', message: 'blocked' },
    },
  ]);

  expect(events[0]).toEqual({
    type: 'error',
    error: { type: 'cyber_policy_violation', message: 'blocked' },
  });
}

function translatedResponse(response: ResponsesResponse) {
  const translated = translateResponse('responses', 'anthropic', response);

  if ('outcome' in translated || 'refusal' in translated) throw new Error('expected response');

  return translated.value;
}

async function stream(source: readonly ResponsesStreamEvent[]): Promise<AnthropicStreamEvent[]> {
  const translated = translateStream('responses', 'anthropic', streamOf(source));

  if ('outcome' in translated) throw new Error('expected stream');

  return collect(translated.stream);
}

function created(): ResponsesStreamEvent {
  return {
    type: 'response.created',
    response: { id: 'resp_1', model: 'gpt-5', status: 'in_progress', output: [] },
  };
}

function completed(output: ResponsesResponse['output']): ResponsesStreamEvent {
  return { type: 'response.completed', response: { id: 'resp_1', status: 'completed', output } };
}

function callAdded(index: number, id: string, name: string): ResponsesStreamEvent {
  return {
    type: 'response.output_item.added',
    output_index: index,
    item: { type: 'function_call', call_id: id, name },
  };
}

function callItem(
  call_id: string,
  name: string,
  argumentsValue: string,
): ResponsesFunctionCallItem {
  return { type: 'function_call', call_id, name, arguments: argumentsValue };
}

function webSearchResponse(): ResponsesResponse {
  return {
    id: 'resp_1',
    status: 'completed',
    output: [
      {
        type: 'web_search_call',
        id: 'ws_1',
        status: 'completed',
        action: { type: 'search', query: 'weather' },
      },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'done' }] },
    ],
  };
}

function signatureDelta(event: AnthropicStreamEvent): string[] {
  return isContentDelta(event) && event.delta.type === 'signature_delta'
    ? [event.delta.signature]
    : [];
}

function textDelta(event: AnthropicStreamEvent): string[] {
  return isContentDelta(event) && event.delta.type === 'text_delta' ? [event.delta.text] : [];
}

function messageStop(events: readonly AnthropicStreamEvent[]): string | undefined {
  return events.find(isMessageDelta)?.delta.stop_reason;
}

type ContentStart = Extract<AnthropicKnownStreamEvent, { type: 'content_block_start' }>;
type ContentDelta = Extract<AnthropicKnownStreamEvent, { type: 'content_block_delta' }>;
type MessageDelta = Extract<AnthropicKnownStreamEvent, { type: 'message_delta' }>;

function isContentStart(event: AnthropicStreamEvent): event is ContentStart {
  return event.type === 'content_block_start' && 'content_block' in event;
}

function isContentDelta(event: AnthropicStreamEvent): event is ContentDelta {
  return event.type === 'content_block_delta' && 'delta' in event;
}

function isMessageDelta(event: AnthropicStreamEvent): event is MessageDelta {
  return event.type === 'message_delta' && 'delta' in event;
}

function contentStartTypes(events: readonly AnthropicStreamEvent[]): string[] {
  const types: string[] = [];

  for (const event of events) {
    if (isContentStart(event)) types.push(event.content_block.type);
  }

  return types;
}
