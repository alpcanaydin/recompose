import type { HubBlockDelta, HubBlockOpening, HubStreamEvent } from './hub';
import type {
  ResponsesKnownStreamEvent,
  ResponsesStreamEvent,
  ResponsesStreamItem,
  ResponsesStreamResponse,
} from './responses-wire';

import {
  statusFromStopReason,
  stopReasonFromResponse,
  toHubUsage,
  toResponsesUsage,
} from './responses-shared';

const streamResponseId = 'resp_translated';

const knownStreamTypes = new Set<string>([
  'response.created',
  'response.output_item.added',
  'response.output_text.delta',
  'response.function_call_arguments.delta',
  'response.output_item.done',
  'response.completed',
  'error',
]);

function isKnownStreamEvent(event: ResponsesStreamEvent): event is ResponsesKnownStreamEvent {
  return knownStreamTypes.has(event.type);
}

function synthesizedToolId(item: { id?: string; call_id?: string }, index: number): string {
  return item.call_id ?? item.id ?? `toolu_stream_${index}`;
}

function blockOpenOf(index: number, item: ResponsesStreamItem): HubStreamEvent {
  switch (item.type) {
    case 'message':
      return { type: 'block-open', index, opening: { kind: 'text' } };
    case 'function_call':
      return {
        type: 'block-open',
        index,
        opening: { kind: 'tool', id: synthesizedToolId(item, index), name: item.name },
      };
    case 'reasoning':
      return { type: 'block-open', index, opening: { kind: 'thinking' } };

    default: {
      const unhandled: never = item;

      throw new Error(`unhandled responses stream item: ${JSON.stringify(unhandled)}`);
    }
  }
}

function terminalStatus(
  status: ResponsesStreamResponse['status'],
): 'completed' | 'incomplete' | 'failed' {
  return status === 'in_progress' ? 'completed' : status;
}

function messageEndOf(response: ResponsesStreamResponse): HubStreamEvent {
  const hasFunctionCall = response.output.some((item) => item.type === 'function_call');
  const outcome = stopReasonFromResponse(
    terminalStatus(response.status),
    hasFunctionCall,
    response.incomplete_details?.reason,
  );

  if ('unmappable' in outcome) {
    return {
      type: 'stream-error',
      error: { type: 'unmappable_stop_reason', message: outcome.unmappable },
    };
  }

  return { type: 'message-end', stopReason: outcome.stopReason, usage: toHubUsage(response.usage) };
}

type ResponsesBlockEvent = Extract<
  ResponsesKnownStreamEvent,
  {
    type:
      | 'response.output_item.added'
      | 'response.output_text.delta'
      | 'response.function_call_arguments.delta'
      | 'response.output_item.done';
  }
>;

function decodeBlockEvent(event: ResponsesBlockEvent): HubStreamEvent[] {
  switch (event.type) {
    case 'response.output_item.added':
      return [blockOpenOf(event.output_index, event.item)];
    case 'response.output_text.delta':
      return [
        {
          type: 'block-delta',
          index: event.output_index,
          delta: { kind: 'text', text: event.delta },
        },
      ];
    case 'response.function_call_arguments.delta':
      return [
        {
          type: 'block-delta',
          index: event.output_index,
          delta: { kind: 'json-args', partialJson: event.delta },
        },
      ];
    case 'response.output_item.done':
      return [{ type: 'block-close', index: event.output_index }];

    default: {
      const unhandled: never = event;

      throw new Error(`unhandled responses block event: ${JSON.stringify(unhandled)}`);
    }
  }
}

function decodeKnownEvent(event: ResponsesKnownStreamEvent): HubStreamEvent[] {
  if (event.type === 'response.created') {
    return [{ type: 'message-begin' }];
  }

  if (event.type === 'response.completed') {
    return [messageEndOf(event.response)];
  }

  if (event.type === 'error') {
    return [{ type: 'stream-error', error: { type: event.code, message: event.message } }];
  }

  return decodeBlockEvent(event);
}

export async function* decodeStream(
  source: AsyncIterable<ResponsesStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  for await (const event of source) {
    if (isKnownStreamEvent(event)) {
      yield* decodeKnownEvent(event);
    }
  }
}

function createdEvent(): ResponsesStreamEvent {
  return {
    type: 'response.created',
    response: { id: streamResponseId, status: 'in_progress', output: [] },
  };
}

function outputItemAddedOf(index: number, opening: HubBlockOpening): ResponsesStreamEvent {
  switch (opening.kind) {
    case 'text':
      return {
        type: 'response.output_item.added',
        output_index: index,
        item: { type: 'message', role: 'assistant' },
      };
    case 'thinking':
      return {
        type: 'response.output_item.added',
        output_index: index,
        item: { type: 'reasoning', id: `rs_stream_${index}` },
      };
    case 'tool':
      return {
        type: 'response.output_item.added',
        output_index: index,
        item: { type: 'function_call', id: opening.id, call_id: opening.id, name: opening.name },
      };

    default: {
      const unhandled: never = opening;

      throw new Error(`unhandled hub block opening: ${JSON.stringify(unhandled)}`);
    }
  }
}

function encodeDelta(index: number, delta: HubBlockDelta): ResponsesStreamEvent[] {
  switch (delta.kind) {
    case 'text':
      return [{ type: 'response.output_text.delta', output_index: index, delta: delta.text }];
    case 'json-args':
      return [
        {
          type: 'response.function_call_arguments.delta',
          output_index: index,
          delta: delta.partialJson,
        },
      ];
    case 'thinking':
    case 'signature':
      return [];

    default: {
      const unhandled: never = delta;

      throw new Error(`unhandled hub block delta: ${JSON.stringify(unhandled)}`);
    }
  }
}

function completedEvent(
  stopReason: HubStreamEndEvent['stopReason'],
  usage: HubStreamEndEvent['usage'],
): ResponsesStreamEvent {
  const outcome = statusFromStopReason(stopReason);

  if ('unmappable' in outcome) {
    return { type: 'error', code: 'unmappable_stop_reason', message: outcome.unmappable };
  }

  return {
    type: 'response.completed',
    response: {
      id: streamResponseId,
      status: outcome.status,
      output: [],
      ...(outcome.incompleteReason === undefined
        ? {}
        : { incomplete_details: { reason: outcome.incompleteReason } }),
      usage: toResponsesUsage(usage),
    },
  };
}

type HubStreamEndEvent = Extract<HubStreamEvent, { type: 'message-end' }>;

type HubStreamTailEvent = Extract<HubStreamEvent, { type: 'block-delta' | 'message-end' }>;

function encodeDeltaOrEnd(event: HubStreamTailEvent): ResponsesStreamEvent[] {
  if (event.type === 'message-end') {
    return [completedEvent(event.stopReason, event.usage)];
  }

  return encodeDelta(event.index, event.delta);
}

function encodeHubEvent(event: HubStreamEvent): ResponsesStreamEvent[] {
  if (event.type === 'message-begin') {
    return [createdEvent()];
  }

  if (event.type === 'block-open') {
    return [outputItemAddedOf(event.index, event.opening)];
  }

  if (event.type === 'block-close') {
    return [{ type: 'response.output_item.done', output_index: event.index }];
  }

  if (event.type === 'stream-error') {
    return [{ type: 'error', code: event.error.type, message: event.error.message }];
  }

  return encodeDeltaOrEnd(event);
}

export async function* encodeStream(
  source: AsyncIterable<HubStreamEvent>,
): AsyncIterable<ResponsesStreamEvent> {
  for await (const event of source) {
    yield* encodeHubEvent(event);
  }
}
