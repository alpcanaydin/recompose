import type { HubBlockDelta, HubBlockOpening, HubStreamEvent, HubUsage } from './hub';
import type {
  InteractionsKnownStreamEvent,
  InteractionsStep,
  InteractionsStreamDelta,
} from './interactions-wire';

import { interactionsUsage } from './interactions-response';

type EncodeState = { id: string; model?: string };

function interaction(state: EncodeState, status: string, usage?: HubUsage) {
  return {
    id: state.id,
    ...(state.model === undefined ? {} : { model: state.model }),
    status,
    ...(usage === undefined ? {} : { usage: interactionsUsage(usage) }),
  };
}

function stepOf(opening: HubBlockOpening): InteractionsStep {
  if (opening.kind === 'text') return { type: 'model_output', content: [] };
  if (opening.kind === 'thinking') return { type: 'thought', content: [] };

  return {
    type: 'function_call',
    id: opening.id,
    call_id: opening.id,
    name: opening.name,
    arguments: {},
    ...(opening.signature === undefined ? {} : { signature: opening.signature }),
  };
}

function deltaOf(delta: HubBlockDelta): InteractionsStreamDelta | undefined {
  if (delta.kind === 'text') return { type: 'text', text: delta.text };

  if (delta.kind === 'thinking') {
    return { type: 'thought_summary', content: { type: 'text', text: delta.text } };
  }

  if (delta.kind === 'signature') {
    return { type: 'thought_signature', signature: delta.signature };
  }

  if (delta.kind === 'annotation') {
    return undefined;
  }

  return { type: 'arguments_delta', arguments: delta.partialJson };
}

function terminalStatus(event: Extract<HubStreamEvent, { type: 'message-end' }>): string {
  if (event.stopReason === 'tool_use') return 'requires_action';

  if (event.stopReason === 'max_output' || event.stopReason === 'context_overflow') {
    return 'incomplete';
  }

  if (event.stopReason === 'refusal') return 'failed';

  return 'completed';
}

function blockEvent(event: HubStreamEvent): InteractionsKnownStreamEvent[] {
  if (event.type === 'block-open') {
    return [{ event_type: 'step.start', index: event.index, step: stepOf(event.opening) }];
  }

  if (event.type === 'block-delta') {
    const delta = deltaOf(event.delta);

    return delta === undefined ? [] : [{ event_type: 'step.delta', index: event.index, delta }];
  }

  if (event.type === 'block-close') {
    return [{ event_type: 'step.stop', index: event.index, status: 'done' }];
  }

  return [];
}

type TerminalEvent = Extract<HubStreamEvent, { type: 'message-end' | 'stream-error' }>;

function terminalEvent(state: EncodeState, event: TerminalEvent): InteractionsKnownStreamEvent[] {
  if (event.type === 'message-end') {
    return [
      {
        event_type: 'interaction.completed',
        interaction: interaction(state, terminalStatus(event), event.usage),
      },
      { event_type: 'done' },
    ];
  }

  return [
    {
      event_type: 'interaction.failed',
      interaction: { ...interaction(state, 'failed'), error: event.error },
    },
  ];
}

function encodeEvent(state: EncodeState, event: HubStreamEvent): InteractionsKnownStreamEvent[] {
  if (event.type === 'message-begin') return beginEvents(state, event);

  return event.type === 'message-end' || event.type === 'stream-error'
    ? terminalEvent(state, event)
    : blockEvent(event);
}

function beginEvents(
  state: EncodeState,
  event: Extract<HubStreamEvent, { type: 'message-begin' }>,
): InteractionsKnownStreamEvent[] {
  state.id = event.id ?? state.id;
  if (event.model === undefined) delete state.model;
  else state.model = event.model;

  return [
    { event_type: 'interaction.created', interaction: interaction(state, 'created') },
    { event_type: 'interaction.status_update', interaction: interaction(state, 'in_progress') },
  ];
}

export async function* encodeStream(
  source: AsyncIterable<HubStreamEvent>,
): AsyncIterable<InteractionsKnownStreamEvent> {
  const state: EncodeState = { id: 'interaction_translated' };

  for await (const event of source) {
    yield* encodeEvent(state, event);

    if (event.type === 'message-end' || event.type === 'stream-error') return;
  }
}
