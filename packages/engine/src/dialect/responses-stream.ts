import type { HubStreamEvent } from './hub';
import type {
  ResponsesKnownStreamEvent,
  ResponsesStreamEvent,
  ResponsesStreamResponse,
} from './responses-wire';

import { codexEventError, codexEventErrorCode } from '../provider/codex-event-error';
import { stopReasonFromResponse, toHubUsage } from './responses-shared';
import { decodeKnownResponsesBlockEvent } from './responses-stream-blocks';
import { hydrateResponsesBlocksAtTerminal } from './responses-stream-completion';
import { responsesImageEvents } from './responses-stream-images';
import { newResponsesBlockState, type ResponsesBlockState } from './responses-stream-state';
import { responsesTerminalDetails } from './responses-stream-terminal';

const knownStreamTypes = new Set<string>([
  'response.created',
  'response.output_item.added',
  'response.output_text.delta',
  'response.reasoning_summary_text.delta',
  'response.image_generation_call.partial_image',
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

  return {
    type: 'message-end',
    ...responsesTerminalDetails(response, outcome.stopReason),
    usage: toHubUsage(response.usage),
  };
}

function decodeKnownEvent(
  event: ResponsesKnownStreamEvent,
  blocks: ResponsesBlockState,
): HubStreamEvent[] {
  const images = responsesImageEvents(event, blocks);

  return images ?? decodeStandardEvent(event, blocks);
}

function decodeStandardEvent(
  event: ResponsesKnownStreamEvent,
  blocks: ResponsesBlockState,
): HubStreamEvent[] {
  if (event.type === 'response.created') return [createdMessageBegin(event)];

  if (isTerminalResponseEvent(event)) {
    return [...hydrateResponsesBlocksAtTerminal(blocks, event.response), ...terminalEvents(event)];
  }

  if (event.type === 'error') {
    return [streamErrorEvent(event)];
  }

  if (isSupplementalDoneEvent(event)) return [];

  return decodeKnownResponsesBlockEvent(blocks, event);
}

function createdMessageBegin(
  event: Extract<ResponsesKnownStreamEvent, { type: 'response.created' }>,
): HubStreamEvent {
  return {
    type: 'message-begin',
    id: event.response.id,
    ...(event.response.model === undefined ? {} : { model: event.response.model }),
  };
}

const supplementalDoneTypes = new Set([
  'response.function_call_arguments.done',
  'response.custom_tool_call_input.delta',
  'response.custom_tool_call_input.done',
  'response.output_text.done',
  'response.content_part.done',
]);

type SupplementalDoneEvent = Extract<
  ResponsesKnownStreamEvent,
  {
    type:
      | 'response.function_call_arguments.done'
      | 'response.custom_tool_call_input.delta'
      | 'response.custom_tool_call_input.done'
      | 'response.output_text.done'
      | 'response.content_part.done';
  }
>;

function isSupplementalDoneEvent(event: ResponsesKnownStreamEvent): event is SupplementalDoneEvent {
  return supplementalDoneTypes.has(event.type);
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

type DecodeLifecycle = { terminal: boolean };

async function* decodedSource(
  source: AsyncIterable<ResponsesStreamEvent>,
  lifecycle: DecodeLifecycle,
): AsyncIterable<HubStreamEvent> {
  const blocks = newResponsesBlockState();

  for await (const event of source) {
    if (!isKnownStreamEvent(event)) {
      continue;
    }

    const hubEvents = decodeKnownEvent(event, blocks);

    for (const hubEvent of hubEvents) {
      yield hubEvent;
    }

    if (hubEvents.some(isTerminal)) {
      lifecycle.terminal = true;

      return;
    }
  }
}

function sourceFailure(failure: unknown): HubStreamEvent {
  return {
    type: 'stream-error',
    error: {
      type: 'upstream_stream_error',
      message: failure instanceof Error ? failure.message : 'Codex upstream stream failed',
    },
  };
}

function incompleteStream(): HubStreamEvent {
  return {
    type: 'stream-error',
    error: {
      type: 'upstream_stream_incomplete',
      message:
        'stream error: stream disconnected before completion: stream closed before response.completed',
    },
  };
}

export async function* decodeStream(
  source: AsyncIterable<ResponsesStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  const lifecycle: DecodeLifecycle = { terminal: false };

  try {
    yield* decodedSource(source, lifecycle);
  } catch (failure) {
    yield sourceFailure(failure);

    return;
  }

  if (!lifecycle.terminal) yield incompleteStream();
}
