import type { HubBlockDelta, HubBlockOpening, HubStreamEvent, HubUsage } from './hub';
import type {
  InteractionsKnownStreamEvent,
  InteractionsStep,
  InteractionsStreamDelta,
} from './interactions-wire';

function interaction(status: string, usage?: HubUsage) {
  return {
    id: 'interaction_translated',
    status,
    ...(usage === undefined ? {} : { usage: interactionUsage(usage) }),
  };
}

function interactionUsage(usage: HubUsage) {
  const result: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    cached_tokens?: number;
    reasoning_tokens?: number;
  } = {};

  if (usage.inputTokens !== undefined) result.total_input_tokens = usage.inputTokens;
  if (usage.outputTokens !== undefined) result.total_output_tokens = usage.outputTokens;
  if (usage.cacheReadTokens !== undefined) result.cached_tokens = usage.cacheReadTokens;
  if (usage.reasoningTokens !== undefined) result.reasoning_tokens = usage.reasoningTokens;

  return result;
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

function deltaOf(delta: HubBlockDelta): InteractionsStreamDelta {
  if (delta.kind === 'text') return { type: 'text', text: delta.text };

  if (delta.kind === 'thinking') {
    return { type: 'thought_summary', content: { type: 'text', text: delta.text } };
  }

  if (delta.kind === 'signature') {
    return { type: 'thought_signature', signature: delta.signature };
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
    return [{ event_type: 'step.delta', index: event.index, delta: deltaOf(event.delta) }];
  }

  if (event.type === 'block-close') {
    return [{ event_type: 'step.stop', index: event.index, status: 'done' }];
  }

  return [];
}

function terminalEvent(event: HubStreamEvent): InteractionsKnownStreamEvent[] {
  if (event.type === 'message-end') {
    return [
      {
        event_type: 'interaction.completed',
        interaction: interaction(terminalStatus(event), event.usage),
      },
    ];
  }

  if (event.type !== 'stream-error') return [];

  return [
    {
      event_type: 'interaction.failed',
      interaction: { ...interaction('failed'), error: event.error },
    },
  ];
}

function encodeEvent(event: HubStreamEvent): InteractionsKnownStreamEvent[] {
  if (event.type === 'message-begin') {
    return [
      { event_type: 'interaction.created', interaction: interaction('created') },
      { event_type: 'interaction.status_update', interaction: interaction('in_progress') },
    ];
  }

  return event.type === 'message-end' || event.type === 'stream-error'
    ? terminalEvent(event)
    : blockEvent(event);
}

export async function* encodeStream(
  source: AsyncIterable<HubStreamEvent>,
): AsyncIterable<InteractionsKnownStreamEvent> {
  for await (const event of source) {
    yield* encodeEvent(event);

    if (event.type === 'message-end' || event.type === 'stream-error') return;
  }
}
