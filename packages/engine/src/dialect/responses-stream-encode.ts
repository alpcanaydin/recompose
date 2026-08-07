import type { HubBlockDelta, HubBlockOpening, HubStreamEvent } from './hub';
import type {
  ResponsesOutputItem,
  ResponsesReasoningItem,
  ResponsesStreamEvent,
  ResponsesStreamItem,
  ResponsesStreamResponse,
} from './responses-wire';

import { encodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import { isGeminiBypass, nativeGeminiSignature } from '../provider/gemini-signature';
import { statusFromStopReason, toResponsesUsage, translatedResponseId } from './responses-shared';

type HubStreamEndEvent = Extract<HubStreamEvent, { type: 'message-end' }>;

type HubStreamTailEvent = Extract<HubStreamEvent, { type: 'block-delta' | 'message-end' }>;

type OpenBlock = {
  outputIndex: number;
  opening: HubBlockOpening;
  arguments: string;
  content: string;
  signature?: string;
};

type EncodeState = {
  blocks: Map<number, OpenBlock>;
  nextOutputIndex: number;
  output: ResponsesOutputItem[];
};

type CarrierOutcome = {
  events: ResponsesStreamEvent[];
  item?: ResponsesReasoningItem;
};

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

function carrierItem(index: number, signature: string): ResponsesReasoningItem {
  return {
    type: 'reasoning',
    id: `rs_stream_${index}`,
    summary: [],
    content: null,
    encrypted_content: encodeGeminiResponsesCarrier({
      signature,
      direction: 'next',
      target: 'function',
    }),
  };
}

function carrierEvents(index: number, opening: HubBlockOpening): CarrierOutcome {
  if (opening.kind !== 'tool') return { events: [] };

  const signature = nativeGeminiSignature(opening.signature);

  if (signature === null || isGeminiBypass(signature)) return { events: [] };

  const item = carrierItem(index, signature);

  return {
    item,
    events: [
      { type: 'response.output_item.added', output_index: index, item },
      { type: 'response.output_item.done', output_index: index, item },
    ],
  };
}

function openBlock(state: EncodeState, sourceIndex: number, opening: HubBlockOpening) {
  const carrier = carrierEvents(state.nextOutputIndex, opening);
  const outputIndex = state.nextOutputIndex + (carrier.item === undefined ? 0 : 1);

  if (carrier.item !== undefined) state.output.push(carrier.item);
  state.nextOutputIndex = outputIndex + 1;
  state.blocks.set(sourceIndex, { outputIndex, opening, arguments: '', content: '' });

  return [...carrier.events, outputItemAddedOf(outputIndex, opening)];
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

function updateBlock(block: OpenBlock, delta: HubBlockDelta): void {
  switch (delta.kind) {
    case 'json-args':
      block.arguments += delta.partialJson;
      break;
    case 'text':
    case 'thinking':
      block.content += delta.text;
      break;
    case 'signature':
      block.signature = delta.signature;
      break;
  }
}

function deltaEvents(state: EncodeState, event: Extract<HubStreamEvent, { type: 'block-delta' }>) {
  const block = state.blocks.get(event.index);
  const index = block?.outputIndex ?? event.index;

  if (block !== undefined) updateBlock(block, event.delta);

  return encodeDelta(index, event.delta);
}

function toolDoneItem(block: OpenBlock): ResponsesStreamItem | undefined {
  if (block.opening.kind !== 'tool') return undefined;

  return {
    type: 'function_call',
    id: block.opening.id,
    call_id: block.opening.id,
    name: block.opening.name,
    arguments: block.arguments,
  };
}

function completedOutput(block: OpenBlock): ResponsesOutputItem {
  if (block.opening.kind === 'tool') {
    return {
      type: 'function_call',
      call_id: block.opening.id,
      name: block.opening.name,
      arguments: block.arguments,
    };
  }

  if (block.opening.kind === 'thinking') {
    return {
      type: 'reasoning',
      id: `rs_stream_${block.outputIndex}`,
      summary: [{ type: 'summary_text', text: block.content }],
      ...(block.signature === undefined ? {} : { encrypted_content: block.signature }),
    };
  }

  return {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: block.content }],
  };
}

function closeBlock(state: EncodeState, sourceIndex: number): ResponsesStreamEvent {
  const block = state.blocks.get(sourceIndex);

  if (block === undefined) return { type: 'response.output_item.done', output_index: sourceIndex };

  state.blocks.delete(sourceIndex);
  state.output.push(completedOutput(block));
  const item = toolDoneItem(block);

  return {
    type: 'response.output_item.done',
    output_index: block.outputIndex,
    ...(item === undefined ? {} : { item }),
  };
}

function completedEvent(
  stopReason: HubStreamEndEvent['stopReason'],
  usage: HubStreamEndEvent['usage'],
  output: readonly ResponsesOutputItem[],
): ResponsesStreamEvent {
  const outcome = statusFromStopReason(stopReason);

  if ('unmappable' in outcome) {
    return { type: 'error', code: 'unmappable_stop_reason', message: outcome.unmappable };
  }

  const response: ResponsesStreamResponse = {
    id: translatedResponseId,
    status: outcome.status,
    output,
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

function encodeDeltaOrEnd(state: EncodeState, event: HubStreamTailEvent): ResponsesStreamEvent[] {
  if (event.type === 'message-end') {
    return [completedEvent(event.stopReason, event.usage, state.output)];
  }

  return deltaEvents(state, event);
}

function encodeHubEvent(state: EncodeState, event: HubStreamEvent): ResponsesStreamEvent[] {
  if (event.type === 'message-begin') {
    return [createdEvent()];
  }

  if (event.type === 'block-open') {
    return openBlock(state, event.index, event.opening);
  }

  if (event.type === 'block-close') {
    return [closeBlock(state, event.index)];
  }

  if (event.type === 'stream-error') {
    return [{ type: 'error', code: event.error.type, message: event.error.message }];
  }

  return encodeDeltaOrEnd(state, event);
}

function isTerminalHubEvent(event: HubStreamEvent): boolean {
  return event.type === 'stream-error' || event.type === 'message-end';
}

export async function* encodeStream(
  source: AsyncIterable<HubStreamEvent>,
): AsyncIterable<ResponsesStreamEvent> {
  const state: EncodeState = { blocks: new Map(), nextOutputIndex: 0, output: [] };

  for await (const event of source) {
    yield* encodeHubEvent(state, event);

    if (isTerminalHubEvent(event)) {
      return;
    }
  }
}
