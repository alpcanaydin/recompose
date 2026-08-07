import type {
  AnthropicBlockDelta,
  AnthropicContentBlock,
  AnthropicStreamEvent,
} from './anthropic-wire';
import type { HubBlockDelta, HubBlockOpening, HubStreamEvent, HubUsage } from './hub';

import { translatedMessageId } from './anthropic-response';
import { wireStopFrom } from './anthropic-stops';
import { wireUsageFrom } from './anthropic-usage';
import { serializeHubBlocks } from './hub-stream-serialize';

type EncodeState = { beginUsage: HubUsage };

type MessageEndEvent = Extract<HubStreamEvent, { type: 'message-end' }>;
type ActiveEvent = Extract<
  HubStreamEvent,
  { type: 'block-open' | 'block-delta' | 'message-end' | 'stream-error' }
>;

function messageStartOf(usage: HubUsage): AnthropicStreamEvent {
  return {
    type: 'message_start',
    message: {
      id: translatedMessageId,
      type: 'message',
      role: 'assistant',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: wireUsageFrom(usage),
    },
  };
}

function openedBlockOf(opening: HubBlockOpening): AnthropicContentBlock {
  switch (opening.kind) {
    case 'text':
      return { type: 'text', text: '' };
    case 'thinking':
      return { type: 'thinking', thinking: '' };
    case 'tool':
      return { type: 'tool_use', id: opening.id, name: opening.name, input: {} };

    default: {
      const unknownOpening: never = opening;

      throw new Error(
        `encodeStream met an unknown block opening: ${JSON.stringify(unknownOpening)}`,
      );
    }
  }
}

function wireDeltaOf(delta: HubBlockDelta): AnthropicBlockDelta {
  switch (delta.kind) {
    case 'text':
      return { type: 'text_delta', text: delta.text };
    case 'json-args':
      return { type: 'input_json_delta', partial_json: delta.partialJson };
    case 'thinking':
      return { type: 'thinking_delta', thinking: delta.text };
    case 'signature':
      return { type: 'signature_delta', signature: delta.signature };

    default: {
      const unknownDelta: never = delta;

      throw new Error(`encodeStream met an unknown block delta: ${JSON.stringify(unknownDelta)}`);
    }
  }
}

function endEventsOf(state: EncodeState, event: MessageEndEvent): AnthropicStreamEvent[] {
  return [
    {
      type: 'message_delta',
      delta: { stop_reason: wireStopFrom(event.stopReason), stop_sequence: null },
      usage: wireUsageFrom({ ...state.beginUsage, ...event.usage }),
    },
    { type: 'message_stop' },
  ];
}

type BlockEvent = Extract<HubStreamEvent, { type: 'block-open' | 'block-delta' }>;

function encodeBlockEvent(event: BlockEvent, events: AnthropicStreamEvent[]): false {
  if (event.type === 'block-open') {
    events.push({
      type: 'content_block_start',
      index: event.index,
      content_block: openedBlockOf(event.opening),
    });

    return false;
  }

  events.push({
    type: 'content_block_delta',
    index: event.index,
    delta: wireDeltaOf(event.delta),
  });

  return false;
}

function encodeActiveEvent(
  state: EncodeState,
  event: ActiveEvent,
  events: AnthropicStreamEvent[],
): boolean {
  if (event.type === 'message-end') {
    events.push(...endEventsOf(state, event));

    return true;
  }

  if (event.type === 'stream-error') {
    events.push({ type: 'error', error: event.error });

    return true;
  }

  return encodeBlockEvent(event, events);
}

function encodeEvent(
  state: EncodeState,
  event: HubStreamEvent,
  events: AnthropicStreamEvent[],
): boolean {
  if (event.type === 'message-begin') {
    state.beginUsage = event.usage ?? {};
    events.push(messageStartOf(state.beginUsage));

    return false;
  }

  if (event.type === 'block-close') {
    events.push({ type: 'content_block_stop', index: event.index });

    return false;
  }

  return encodeActiveEvent(state, event, events);
}

export async function* encodeStream(
  source: AsyncIterable<HubStreamEvent>,
): AsyncIterable<AnthropicStreamEvent> {
  const state: EncodeState = { beginUsage: {} };

  for await (const event of serializeHubBlocks(source)) {
    const events: AnthropicStreamEvent[] = [];
    const done = encodeEvent(state, event, events);

    for (const wireEvent of events) {
      yield wireEvent;
    }

    if (done) {
      return;
    }
  }
}
