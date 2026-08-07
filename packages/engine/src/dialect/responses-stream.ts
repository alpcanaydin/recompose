import type { HubStreamEvent } from './hub';
import type {
  ResponsesKnownStreamEvent,
  ResponsesStreamEvent,
  ResponsesStreamResponse,
} from './responses-wire';

import { codexEventError, codexEventErrorCode } from '../provider/codex-event-error';
import { stopReasonFromResponse, toHubUsage } from './responses-shared';
import {
  decodeResponsesBlockEvent,
  newResponsesBlockState,
  type ResponsesBlockState,
} from './responses-stream-blocks';
import { hydrateResponsesBlocksAtTerminal } from './responses-stream-completion';

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

function decodeKnownEvent(
  event: ResponsesKnownStreamEvent,
  blocks: ResponsesBlockState,
): HubStreamEvent[] {
  if (event.type === 'response.created') {
    return [
      {
        type: 'message-begin',
        id: event.response.id,
        ...(event.response.model === undefined ? {} : { model: event.response.model }),
      },
    ];
  }

  if (isTerminalResponseEvent(event)) {
    return [...hydrateResponsesBlocksAtTerminal(blocks, event.response), ...terminalEvents(event)];
  }

  if (event.type === 'error') {
    return [streamErrorEvent(event)];
  }

  return decodeResponsesBlockEvent(blocks, event);
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
