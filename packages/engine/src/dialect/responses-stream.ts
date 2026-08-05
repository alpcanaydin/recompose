import type { HubStreamEvent } from './hub';
import type {
  ResponsesKnownStreamEvent,
  ResponsesStreamEvent,
  ResponsesStreamItem,
  ResponsesStreamResponse,
} from './responses-wire';

import { stopReasonFromResponse, toHubUsage } from './responses-shared';
import { sanitizeToolId } from './tool-id';

const knownStreamTypes = new Set<string>([
  'response.created',
  'response.output_item.added',
  'response.output_text.delta',
  'response.reasoning_summary_text.delta',
  'response.function_call_arguments.delta',
  'response.output_item.done',
  'response.completed',
  'response.incomplete',
  'error',
]);

function isKnownStreamEvent(event: ResponsesStreamEvent): event is ResponsesKnownStreamEvent {
  return knownStreamTypes.has(event.type);
}

function synthesizedToolId(item: { id?: string; call_id?: string }, index: number): string {
  return sanitizeToolId(item.call_id ?? item.id ?? `toolu_stream_${String(index)}`);
}

function blockOpenOf(index: number, item: ResponsesStreamItem): HubStreamEvent | undefined {
  switch (item.type) {
    case 'message':
      return { type: 'block-open', index, opening: { kind: 'text' } };
    case 'function_call':
      return {
        type: 'block-open',
        index,
        opening: { kind: 'tool', id: synthesizedToolId(item, index), name: item.name ?? '' },
      };
    case 'reasoning':
      return { type: 'block-open', index, opening: { kind: 'thinking' } };

    default:
      return undefined;
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
      | 'response.reasoning_summary_text.delta'
      | 'response.function_call_arguments.delta'
      | 'response.output_item.done';
  }
>;

function openBlock(
  event: ResponsesBlockEvent & { type: 'response.output_item.added' },
  skipped: Set<number>,
): HubStreamEvent[] {
  const open = blockOpenOf(event.output_index, event.item);

  if (open === undefined) {
    skipped.add(event.output_index);

    return [];
  }

  return [open];
}

function decodeDeltaOrClose(
  event: Exclude<ResponsesBlockEvent, { type: 'response.output_item.added' }>,
): HubStreamEvent[] {
  switch (event.type) {
    case 'response.output_text.delta':
      return [
        {
          type: 'block-delta',
          index: event.output_index,
          delta: { kind: 'text', text: event.delta },
        },
      ];
    case 'response.reasoning_summary_text.delta':
      return [
        {
          type: 'block-delta',
          index: event.output_index,
          delta: { kind: 'thinking', text: event.delta },
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

function decodeBlockEvent(event: ResponsesBlockEvent, skipped: Set<number>): HubStreamEvent[] {
  if (event.type === 'response.output_item.added') {
    return openBlock(event, skipped);
  }

  return skipped.has(event.output_index) ? [] : decodeDeltaOrClose(event);
}

function decodeKnownEvent(
  event: ResponsesKnownStreamEvent,
  skipped: Set<number>,
): HubStreamEvent[] {
  if (event.type === 'response.created') {
    return [{ type: 'message-begin' }];
  }

  if (event.type === 'response.completed' || event.type === 'response.incomplete') {
    return [messageEndOf(event.response)];
  }

  if (event.type === 'error') {
    return [{ type: 'stream-error', error: { type: event.code, message: event.message } }];
  }

  return decodeBlockEvent(event, skipped);
}

function isTerminal(event: HubStreamEvent): boolean {
  return event.type === 'stream-error' || event.type === 'message-end';
}

export async function* decodeStream(
  source: AsyncIterable<ResponsesStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  const skipped = new Set<number>();

  for await (const event of source) {
    if (!isKnownStreamEvent(event)) {
      continue;
    }

    const hubEvents = decodeKnownEvent(event, skipped);

    for (const hubEvent of hubEvents) {
      yield hubEvent;
    }

    if (hubEvents.some(isTerminal)) {
      return;
    }
  }
}
