import type { HubBlockDelta, HubBlockOpening, HubStreamEvent } from './hub';
import type { ResponsesStreamEvent, ResponsesStreamResponse } from './responses-wire';

import { statusFromStopReason, toResponsesUsage, translatedResponseId } from './responses-shared';

type HubStreamEndEvent = Extract<HubStreamEvent, { type: 'message-end' }>;

type HubStreamTailEvent = Extract<HubStreamEvent, { type: 'block-delta' | 'message-end' }>;

function createdEvent(): ResponsesStreamEvent {
  return {
    type: 'response.created',
    response: { id: translatedResponseId, status: 'in_progress', output: [] },
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
      return [
        { type: 'response.reasoning_summary_text.delta', output_index: index, delta: delta.text },
      ];
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

  const response: ResponsesStreamResponse = {
    id: translatedResponseId,
    status: outcome.status,
    output: [],
    ...(outcome.incompleteReason === undefined
      ? {}
      : { incomplete_details: { reason: outcome.incompleteReason } }),
    usage: toResponsesUsage(usage),
  };

  if (outcome.status === 'incomplete') {
    return { type: 'response.incomplete', response };
  }

  return { type: 'response.completed', response };
}

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

function isTerminalHubEvent(event: HubStreamEvent): boolean {
  return event.type === 'stream-error' || event.type === 'message-end';
}

export async function* encodeStream(
  source: AsyncIterable<HubStreamEvent>,
): AsyncIterable<ResponsesStreamEvent> {
  for await (const event of source) {
    yield* encodeHubEvent(event);

    if (isTerminalHubEvent(event)) {
      return;
    }
  }
}
