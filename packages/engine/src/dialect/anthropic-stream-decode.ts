import type {
  AnthropicBlockDelta,
  AnthropicKnownStreamEvent,
  AnthropicStreamContentBlock,
  AnthropicStreamEvent,
} from './anthropic-wire';
import type { HubStopReason, HubStreamEvent, HubUsage } from './hub';

import { hubStopFrom } from './anthropic-stops';
import { hubUsageFrom } from './anthropic-usage';

const knownStreamTypes = new Set<string>([
  'message_start',
  'content_block_start',
  'content_block_delta',
  'content_block_stop',
  'message_delta',
  'message_stop',
  'ping',
  'error',
]);

function isKnownStreamEvent(event: AnthropicStreamEvent): event is AnthropicKnownStreamEvent {
  return knownStreamTypes.has(event.type);
}

type DecodeState = {
  stopReason: HubStopReason;
  usage: HubUsage;
  skipped: Set<number>;
  lastTextIndex: number | undefined;
};

function initialDecodeState(): DecodeState {
  return { stopReason: 'end', usage: {}, skipped: new Set(), lastTextIndex: undefined };
}

function blockOpenOf(
  index: number,
  block: AnthropicStreamContentBlock,
): HubStreamEvent | undefined {
  if (block.type === 'text') {
    return { type: 'block-open', index, opening: { kind: 'text' } };
  }

  if (block.type === 'thinking') {
    return { type: 'block-open', index, opening: { kind: 'thinking' } };
  }

  if (block.type === 'redacted_thinking') {
    return {
      type: 'block-open',
      index,
      opening: { kind: 'thinking', signature: `claude-redacted-thinking:${block.data}` },
    };
  }

  if (block.type === 'tool_use') {
    return { type: 'block-open', index, opening: { kind: 'tool', id: block.id, name: block.name } };
  }

  return undefined;
}

function openBlock(
  index: number,
  block: AnthropicStreamContentBlock,
  state: DecodeState,
): HubStreamEvent[] {
  const open = blockOpenOf(index, block);

  if (open === undefined) {
    state.skipped.add(index);

    return [];
  }

  if (open.type === 'block-open' && open.opening.kind === 'text') state.lastTextIndex = index;

  return [open];
}

function hubDeltaOf(index: number, delta: AnthropicBlockDelta): HubStreamEvent {
  if (delta.type === 'citations_delta') {
    return {
      type: 'block-delta',
      index,
      delta: { kind: 'annotation', annotation: delta.citation },
    };
  }

  return standardHubDeltaOf(index, delta);
}

function standardHubDeltaOf(
  index: number,
  delta: Exclude<AnthropicBlockDelta, { type: 'citations_delta' }>,
): HubStreamEvent {
  switch (delta.type) {
    case 'text_delta':
      return { type: 'block-delta', index, delta: { kind: 'text', text: delta.text } };
    case 'input_json_delta':
      return {
        type: 'block-delta',
        index,
        delta: { kind: 'json-args', partialJson: delta.partial_json },
      };
    case 'thinking_delta':
      return { type: 'block-delta', index, delta: { kind: 'thinking', text: delta.thinking } };
    case 'signature_delta':
      return {
        type: 'block-delta',
        index,
        delta: { kind: 'signature', signature: delta.signature },
      };

    default: {
      const unknownDelta: never = delta;

      throw new Error(`decodeStream met an unknown delta: ${JSON.stringify(unknownDelta)}`);
    }
  }
}

type BlockEvent = Extract<
  AnthropicKnownStreamEvent,
  { type: 'content_block_start' | 'content_block_delta' | 'content_block_stop' }
>;

function decodeBlockEvent(event: BlockEvent, state: DecodeState): HubStreamEvent[] {
  if (event.type === 'content_block_start') {
    return openBlock(event.index, event.content_block, state);
  }

  return decodeExistingBlockEvent(event, state);
}

function decodeExistingBlockEvent(
  event: Exclude<BlockEvent, { type: 'content_block_start' }>,
  state: DecodeState,
): HubStreamEvent[] {
  if (event.type === 'content_block_delta' && event.delta.type === 'citations_delta') {
    return citationEvents(event.delta, state);
  }

  if (state.skipped.has(event.index)) {
    return [];
  }

  if (event.type === 'content_block_delta') {
    return [hubDeltaOf(event.index, event.delta)];
  }

  return [{ type: 'block-close', index: event.index }];
}

function citationEvents(
  delta: Extract<AnthropicBlockDelta, { type: 'citations_delta' }>,
  state: DecodeState,
) {
  return state.lastTextIndex === undefined ? [] : [hubDeltaOf(state.lastTextIndex, delta)];
}

type EnvelopeEvent = Extract<
  AnthropicKnownStreamEvent,
  { type: 'message_start' | 'message_delta' | 'message_stop' | 'ping' | 'error' }
>;

type MessageEvent = Exclude<EnvelopeEvent, { type: 'ping' | 'error' }>;

function decodeMessageEvent(event: MessageEvent, state: DecodeState): HubStreamEvent[] {
  switch (event.type) {
    case 'message_start':
      state.usage = hubUsageFrom(event.message.usage);

      return [
        {
          type: 'message-begin',
          usage: state.usage,
          id: event.message.id,
          ...(event.message.model === undefined ? {} : { model: event.message.model }),
        },
      ];
    case 'message_delta':
      state.stopReason = hubStopFrom(event.delta.stop_reason);
      state.usage = { ...state.usage, ...hubUsageFrom(event.usage) };

      return [];
    case 'message_stop':
      return [{ type: 'message-end', stopReason: state.stopReason, usage: state.usage }];

    default: {
      const unknownEvent: never = event;

      throw new Error(`decodeStream met an unknown event: ${JSON.stringify(unknownEvent)}`);
    }
  }
}

function decodeEnvelopeEvent(event: EnvelopeEvent, state: DecodeState): HubStreamEvent[] {
  if (event.type === 'ping') {
    return [];
  }

  if (event.type === 'error') {
    return [{ type: 'stream-error', error: event.error }];
  }

  return decodeMessageEvent(event, state);
}

function isBlockEvent(event: AnthropicKnownStreamEvent): event is BlockEvent {
  return (
    event.type === 'content_block_start' ||
    event.type === 'content_block_delta' ||
    event.type === 'content_block_stop'
  );
}

function isTerminal(event: HubStreamEvent): boolean {
  return event.type === 'stream-error' || event.type === 'message-end';
}

function decodeEvent(event: AnthropicKnownStreamEvent, state: DecodeState): HubStreamEvent[] {
  return isBlockEvent(event) ? decodeBlockEvent(event, state) : decodeEnvelopeEvent(event, state);
}

export async function* decodeStream(
  source: AsyncIterable<AnthropicStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  const state = initialDecodeState();

  for await (const event of source) {
    if (!isKnownStreamEvent(event)) {
      continue;
    }

    const hubEvents = decodeEvent(event, state);

    for (const hubEvent of hubEvents) {
      yield hubEvent;
    }

    if (hubEvents.some(isTerminal)) {
      return;
    }
  }
}
