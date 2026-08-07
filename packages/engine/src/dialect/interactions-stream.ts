import type { HubBlockDelta, HubBlockOpening, HubStopReason, HubStreamEvent } from './hub';
import type {
  InteractionsKnownStreamEvent,
  InteractionsStep,
  InteractionsStreamDelta,
  InteractionsStreamEvent,
} from './interactions-wire';

import { hubUsageFromInteractions } from './interactions-response';

type StreamState = {
  began: boolean;
  ended: boolean;
  open: Set<number>;
  sawTool: boolean;
};

function openingOf(step: InteractionsStep): HubBlockOpening | null {
  if (step.type === 'model_output') return { kind: 'text' };
  if (step.type === 'thought') return { kind: 'thinking' };

  return step.type === 'function_call' ? toolOpening(step) : null;
}

function toolOpening(step: Extract<InteractionsStep, { type: 'function_call' }>): HubBlockOpening {
  return {
    kind: 'tool',
    id: step.call_id ?? step.id ?? step.name,
    name: step.name,
    ...(step.signature === undefined ? {} : { signature: step.signature }),
  };
}

function deltaOf(delta: InteractionsStreamDelta): HubBlockDelta | null {
  if (delta.type === 'text') return { kind: 'text', text: delta.text };
  if (delta.type === 'thought_summary') return { kind: 'thinking', text: delta.content.text };

  if (delta.type === 'thought_signature') {
    return delta.signature === '' ? null : { kind: 'signature', signature: delta.signature };
  }

  return { kind: 'json-args', partialJson: delta.arguments };
}

function startEvents(
  state: StreamState,
  event: Extract<InteractionsKnownStreamEvent, { event_type: 'step.start' }>,
): HubStreamEvent[] {
  if (state.open.has(event.index)) return [];

  const opening = openingOf(event.step);

  if (opening === null) return [];

  state.open.add(event.index);
  state.sawTool ||= opening.kind === 'tool';

  return [{ type: 'block-open', index: event.index, opening }];
}

function deltaEvents(
  state: StreamState,
  event: Extract<InteractionsKnownStreamEvent, { event_type: 'step.delta' }>,
): HubStreamEvent[] {
  if (!state.open.has(event.index)) return [];

  const delta = deltaOf(event.delta);

  return delta === null ? [] : [{ type: 'block-delta', index: event.index, delta }];
}

function stopEvents(
  state: StreamState,
  event: Extract<InteractionsKnownStreamEvent, { event_type: 'step.stop' }>,
): HubStreamEvent[] {
  if (!state.open.delete(event.index)) return [];

  return [{ type: 'block-close', index: event.index }];
}

function terminalReason(status: string | undefined, sawTool: boolean): HubStopReason {
  if (status === 'requires_action' || sawTool) return 'tool_use';
  if (status === 'incomplete') return 'max_output';
  if (status === 'failed') return 'refusal';

  return 'end';
}

function completedEvents(
  state: StreamState,
  event: Extract<InteractionsKnownStreamEvent, { event_type: 'interaction.completed' }>,
): HubStreamEvent[] {
  if (state.ended) return [];

  state.ended = true;

  return [
    {
      type: 'message-end',
      stopReason: terminalReason(event.interaction.status, state.sawTool),
      usage: hubUsageFromInteractions(event.interaction.usage),
    },
  ];
}

function finishEvents(
  state: StreamState,
  event: Extract<InteractionsKnownStreamEvent, { event_type: 'finish' }>,
): HubStreamEvent[] {
  if (state.ended) return [];

  state.ended = true;

  return [
    {
      type: 'message-end',
      stopReason: terminalReason(undefined, state.sawTool),
      usage: hubUsageFromInteractions(event.metadata?.total_usage),
    },
  ];
}

function failedEvents(
  state: StreamState,
  event: Extract<InteractionsKnownStreamEvent, { event_type: 'interaction.failed' }>,
): HubStreamEvent[] {
  if (state.ended) return [];

  state.ended = true;

  return [
    {
      type: 'stream-error',
      error: event.interaction.error ?? {
        type: 'interactions_error',
        message: 'The interaction failed.',
      },
    },
  ];
}

function createdEvents(state: StreamState): HubStreamEvent[] {
  if (state.began) return [];

  state.began = true;

  return [{ type: 'message-begin' }];
}

function blockEvents(state: StreamState, event: InteractionsKnownStreamEvent): HubStreamEvent[] {
  if (event.event_type === 'step.start') return startEvents(state, event);
  if (event.event_type === 'step.delta') return deltaEvents(state, event);
  if (event.event_type === 'step.stop') return stopEvents(state, event);

  return [];
}

function knownEvents(state: StreamState, event: InteractionsKnownStreamEvent): HubStreamEvent[] {
  if (event.event_type === 'interaction.created') {
    return createdEvents(state);
  }

  if (event.event_type === 'interaction.completed') return completedEvents(state, event);
  if (event.event_type === 'interaction.failed') return failedEvents(state, event);
  if (event.event_type === 'finish') return finishEvents(state, event);

  return blockEvents(state, event);
}

function isKnown(event: InteractionsStreamEvent): event is InteractionsKnownStreamEvent {
  return [
    'interaction.created',
    'interaction.status_update',
    'step.start',
    'step.delta',
    'step.stop',
    'interaction.requires_action',
    'interaction.completed',
    'interaction.failed',
    'finish',
    'done',
  ].includes(event.event_type);
}

export async function* decodeStream(
  source: AsyncIterable<InteractionsStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  const state: StreamState = { began: false, ended: false, open: new Set(), sawTool: false };

  for await (const event of source) {
    if (!isKnown(event)) continue;

    yield* knownEvents(state, event);

    if (state.ended) return;
  }
}
