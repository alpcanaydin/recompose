import type { HubStreamEvent } from './hub';
import type {
  ResponsesKnownStreamEvent,
  ResponsesStreamEvent,
  ResponsesStreamItem,
  ResponsesStreamResponse,
} from './responses-wire';

import { codexEventError, codexEventErrorCode } from '../provider/codex-event-error';
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
  'response.failed',
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

function closeBlock(
  event: Extract<ResponsesBlockEvent, { type: 'response.output_item.done' }>,
): HubStreamEvent[] {
  const signature = event.item?.encrypted_content;
  const signatureEvent: HubStreamEvent[] =
    event.item?.type === 'reasoning' && signature !== undefined
      ? [
          {
            type: 'block-delta',
            index: event.output_index,
            delta: { kind: 'signature', signature },
          },
        ]
      : [];

  return [...signatureEvent, { type: 'block-close', index: event.output_index }];
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
      return closeBlock(event);

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

  if (isTerminalResponseEvent(event)) {
    return terminalEvents(event);
  }

  if (event.type === 'error') {
    return [streamErrorEvent(event)];
  }

  return decodeBlockEvent(event, skipped);
}

type TerminalResponseEvent = Extract<
  ResponsesKnownStreamEvent,
  { type: 'response.completed' | 'response.incomplete' | 'response.failed' }
>;

function isTerminalResponseEvent(event: ResponsesKnownStreamEvent): event is TerminalResponseEvent {
  return terminalResponseTypes.has(event.type);
}

const terminalResponseTypes = new Set([
  'response.completed',
  'response.incomplete',
  'response.failed',
]);

function terminalEvents(event: TerminalResponseEvent): HubStreamEvent[] {
  if (event.type !== 'response.failed') {
    return [messageEndOf(event.response)];
  }

  return [failedResponseEvent(event.response)];
}

function failedResponseEvent(response: ResponsesStreamResponse): HubStreamEvent {
  const parsed = codexEventError({ type: 'response.failed', response });

  return {
    type: 'stream-error',
    error: {
      type: parsed === null ? 'api_error' : codexEventErrorCode(parsed),
      message: parsed?.message ?? 'Codex response failed',
    },
  };
}

function streamErrorEvent(event: ResponsesKnownStreamEvent & { type: 'error' }): HubStreamEvent {
  const parsed = codexEventError(event);

  return {
    type: 'stream-error',
    error: {
      type: parsed === null ? 'api_error' : codexEventErrorCode(parsed),
      message: parsed?.message ?? 'Codex response failed',
    },
  };
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
