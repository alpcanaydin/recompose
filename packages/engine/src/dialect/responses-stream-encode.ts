import type { HubBlockOpening, HubStreamEvent } from './hub';
import type {
  ResponsesOutputItem,
  ResponsesReasoningItem,
  ResponsesStreamEvent,
  ResponsesStreamResponse,
} from './responses-wire';

import { encodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import { isGeminiBypass, nativeGeminiSignature } from '../provider/gemini-signature';
import { responsesItemForGeminiTextSignature } from './responses-gemini-carrier';
import { responsesItemForGeminiReasoningSignature } from './responses-gemini-carrier';
import { statusFromStopReason, toResponsesUsage, translatedResponseId } from './responses-shared';
import { responsesDeltaEvents, updateResponsesBlock } from './responses-stream-deltas';
import {
  completedResponsesOutput,
  responsesDoneEvents,
  type ResponsesOpenBlock,
} from './responses-stream-done';

type HubStreamEndEvent = Extract<HubStreamEvent, { type: 'message-end' }>;

type HubStreamTailEvent = Extract<HubStreamEvent, { type: 'block-delta' | 'message-end' }>;

type EncodeState = {
  blocks: Map<number, ResponsesOpenBlock>;
  nextOutputIndex: number;
  output: ResponsesOutputItem[];
  id: string | undefined;
  model: string | undefined;
};

type CarrierOutcome = {
  events: ResponsesStreamEvent[];
  item?: ResponsesReasoningItem;
};

function createdEvent(state: EncodeState): ResponsesStreamEvent {
  return {
    type: 'response.created',
    response: {
      id: state.id ?? translatedResponseId,
      ...(state.model === undefined ? {} : { model: state.model }),
      status: 'in_progress',
      output: [],
    },
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
      return thinkingItemAdded(index, opening);
    case 'tool':
      return {
        type: 'response.output_item.added',
        output_index: index,
        item: {
          type: 'function_call',
          id: `fc_${opening.id}`,
          call_id: opening.id,
          name: opening.name,
        },
      };

    default: {
      const unhandled: never = opening;

      throw new Error(`unhandled hub block opening: ${JSON.stringify(unhandled)}`);
    }
  }
}

function thinkingItemAdded(
  index: number,
  opening: Extract<HubBlockOpening, { kind: 'thinking' }>,
): ResponsesStreamEvent {
  const carrier = responsesItemForGeminiReasoningSignature(
    opening.signature,
    opening.carrierDirection,
    opening.carrierTarget,
  );

  return {
    type: 'response.output_item.added',
    output_index: index,
    item: {
      type: 'reasoning',
      id: `rs_stream_${index}`,
      ...(carrier?.encrypted_content === undefined
        ? {}
        : { encrypted_content: carrier.encrypted_content }),
    },
  };
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
  state.blocks.set(sourceIndex, newOpenBlock(outputIndex, opening));

  return [...carrier.events, outputItemAddedOf(outputIndex, opening)];
}

function newOpenBlock(outputIndex: number, opening: HubBlockOpening): ResponsesOpenBlock {
  return {
    outputIndex,
    opening,
    arguments: '',
    content: '',
    annotations: [],
    ...(opening.signature !== undefined ? { signature: opening.signature } : {}),
  };
}

function deltaEvents(state: EncodeState, event: Extract<HubStreamEvent, { type: 'block-delta' }>) {
  const block = state.blocks.get(event.index);
  const index = block?.outputIndex ?? event.index;

  if (block !== undefined) updateResponsesBlock(block, event.delta);

  return responsesDeltaEvents(index, event.delta);
}

function closeBlock(state: EncodeState, sourceIndex: number): ResponsesStreamEvent[] {
  const block = state.blocks.get(sourceIndex);

  if (block === undefined)
    return [{ type: 'response.output_item.done', output_index: sourceIndex }];

  state.blocks.delete(sourceIndex);
  state.output.push(completedResponsesOutput(block));

  const carrier =
    block.opening.kind === 'text'
      ? responsesItemForGeminiTextSignature(block.signature, 'previous')
      : null;

  if (carrier === null) return responsesDoneEvents(block);

  const index = state.nextOutputIndex;
  const item = { ...carrier, id: `rs_stream_${index}` };

  state.nextOutputIndex += 1;
  state.output.push(item);

  return [
    ...responsesDoneEvents(block),
    { type: 'response.output_item.added', output_index: index, item },
    { type: 'response.output_item.done', output_index: index, item },
  ];
}

function completedEvent(
  state: EncodeState,
  stopReason: HubStreamEndEvent['stopReason'],
  usage: HubStreamEndEvent['usage'],
  output: readonly ResponsesOutputItem[],
): ResponsesStreamEvent {
  const outcome = statusFromStopReason(stopReason);

  if ('unmappable' in outcome) {
    return { type: 'error', code: 'unmappable_stop_reason', message: outcome.unmappable };
  }

  const response = completedResponse(state, outcome, usage, output);

  return outcome.status === 'incomplete'
    ? { type: 'response.incomplete', response }
    : { type: 'response.completed', response };
}

function completedResponse(
  state: EncodeState,
  outcome: Exclude<ReturnType<typeof statusFromStopReason>, { unmappable: string }>,
  usage: HubStreamEndEvent['usage'],
  output: readonly ResponsesOutputItem[],
): ResponsesStreamResponse {
  return {
    id: state.id ?? translatedResponseId,
    ...(state.model === undefined ? {} : { model: state.model }),
    status: outcome.status,
    output,
    ...(outcome.incompleteReason === undefined
      ? {}
      : { incomplete_details: { reason: outcome.incompleteReason } }),
    usage: toResponsesUsage(usage),
  };
}

function encodeDeltaOrEnd(state: EncodeState, event: HubStreamTailEvent): ResponsesStreamEvent[] {
  if (event.type === 'message-end') {
    return [completedEvent(state, event.stopReason, event.usage, state.output)];
  }

  return deltaEvents(state, event);
}

function encodeHubEvent(state: EncodeState, event: HubStreamEvent): ResponsesStreamEvent[] {
  if (event.type === 'media') return [];

  return encodeNonMediaHubEvent(state, event);
}

function encodeNonMediaHubEvent(
  state: EncodeState,
  event: Exclude<HubStreamEvent, { type: 'media' }>,
): ResponsesStreamEvent[] {
  if (event.type === 'message-begin') {
    state.id = event.id;
    state.model = event.model;

    return [createdEvent(state)];
  }

  if (event.type === 'block-open') {
    return openBlock(state, event.index, event.opening);
  }

  if (event.type === 'block-close') {
    return closeBlock(state, event.index);
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
  const state: EncodeState = {
    blocks: new Map(),
    nextOutputIndex: 0,
    output: [],
    id: undefined,
    model: undefined,
  };

  for await (const event of source) {
    yield* encodeHubEvent(state, event);

    if (isTerminalHubEvent(event)) {
      return;
    }
  }
}
