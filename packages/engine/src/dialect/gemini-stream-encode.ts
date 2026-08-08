import type { GeminiPart, GeminiResponse } from './gemini-wire';
import type { HubBlockOpening, HubStreamEvent, HubUsage } from './hub';

import { geminiMediaPart } from './gemini-media';
import { geminiUsageFromHub } from './gemini-response-encode';
import { parseToolArguments } from './hub-build';

type OpenBlock = {
  opening: HubBlockOpening;
  arguments: string;
  signature?: string;
};

type EncodeState = {
  blocks: Map<number, OpenBlock>;
  id: string | undefined;
  model: string | undefined;
  beginUsage: HubUsage;
};

function responseOf(
  state: EncodeState,
  parts: GeminiPart[],
  finishReason?: string,
): GeminiResponse {
  return {
    ...(state.id === undefined ? {} : { responseId: state.id }),
    ...(state.model === undefined ? {} : { modelVersion: state.model }),
    candidates: [
      {
        content: { role: 'model', parts },
        ...(finishReason === undefined ? {} : { finishReason }),
      },
    ],
  };
}

function openBlock(state: EncodeState, index: number, opening: HubBlockOpening): void {
  state.blocks.set(index, {
    opening,
    arguments: '',
    ...(opening.kind === 'tool' && opening.signature !== undefined
      ? { signature: opening.signature }
      : {}),
  });
}

function updateBlock(
  block: OpenBlock,
  event: Extract<HubStreamEvent, { type: 'block-delta' }>,
): void {
  if (event.delta.kind === 'json-args') block.arguments += event.delta.partialJson;
  if (event.delta.kind === 'signature') block.signature = event.delta.signature;
}

function deltaPart(event: Extract<HubStreamEvent, { type: 'block-delta' }>): GeminiPart | null {
  if (event.delta.kind === 'text') return { text: event.delta.text };
  if (event.delta.kind === 'thinking') return { text: event.delta.text, thought: true };

  return null;
}

function deltaResponses(
  state: EncodeState,
  event: Extract<HubStreamEvent, { type: 'block-delta' }>,
): GeminiResponse[] {
  const block = state.blocks.get(event.index);

  if (block !== undefined) updateBlock(block, event);

  const part = deltaPart(event);

  return part === null ? [] : [responseOf(state, [part])];
}

function toolPart(block: OpenBlock): GeminiPart | null {
  if (block.opening.kind !== 'tool') return null;

  return {
    functionCall: {
      id: block.opening.id,
      name: block.opening.name,
      args: parseToolArguments(block.arguments === '' ? '{}' : block.arguments),
    },
    ...(block.signature === undefined ? {} : { thoughtSignature: block.signature }),
  };
}

function closeResponses(state: EncodeState, index: number): GeminiResponse[] {
  const block = state.blocks.get(index);

  if (block === undefined) return [];

  state.blocks.delete(index);

  const part = toolPart(block);

  return part === null ? [] : [responseOf(state, [part])];
}

function finishReason(event: Extract<HubStreamEvent, { type: 'message-end' }>): string {
  if (event.stopReason === 'max_output' || event.stopReason === 'context_overflow') {
    return 'MAX_TOKENS';
  }

  if (event.stopReason === 'refusal') return 'SAFETY';

  return 'STOP';
}

function endResponse(
  state: EncodeState,
  event: Extract<HubStreamEvent, { type: 'message-end' }>,
): GeminiResponse {
  const response = responseOf(state, [], finishReason(event));
  const usage = { ...state.beginUsage, ...event.usage };

  response.usageMetadata = geminiUsageFromHub(usage);

  return response;
}

function errorResponse(
  state: EncodeState,
  event: Extract<HubStreamEvent, { type: 'stream-error' }>,
): GeminiResponse {
  return responseOf(state, [{ text: event.error.message }], 'SAFETY');
}

function beginEvent(
  state: EncodeState,
  event: Extract<HubStreamEvent, { type: 'message-begin' }>,
): GeminiResponse[] {
  state.id = event.id;
  state.model = event.model;
  state.beginUsage = event.usage ?? {};

  return [];
}

function openedEvent(
  state: EncodeState,
  event: Extract<HubStreamEvent, { type: 'block-open' }>,
): GeminiResponse[] {
  openBlock(state, event.index, event.opening);

  return [];
}

function activeEvent(
  state: EncodeState,
  event: Exclude<HubStreamEvent, { type: 'message-begin' | 'block-open' }>,
): GeminiResponse[] {
  if (event.type === 'media') return mediaResponses(state, event);

  return standardActiveEvent(state, event);
}

function mediaResponses(
  state: EncodeState,
  event: Extract<HubStreamEvent, { type: 'media' }>,
): GeminiResponse[] {
  const part = geminiMediaPart(event.block);

  return part === null ? [] : [responseOf(state, [part])];
}

function standardActiveEvent(
  state: EncodeState,
  event: Exclude<HubStreamEvent, { type: 'message-begin' | 'block-open' | 'media' }>,
): GeminiResponse[] {
  if (event.type === 'block-delta') return deltaResponses(state, event);
  if (event.type === 'block-close') return closeResponses(state, event.index);
  if (event.type === 'message-end') return [endResponse(state, event)];

  return [errorResponse(state, event)];
}

function encodeEvent(state: EncodeState, event: HubStreamEvent): GeminiResponse[] {
  if (event.type === 'message-begin') return beginEvent(state, event);
  if (event.type === 'block-open') return openedEvent(state, event);

  return activeEvent(state, event);
}

export async function* encodeStream(
  source: AsyncIterable<HubStreamEvent>,
): AsyncIterable<GeminiResponse> {
  const state: EncodeState = { blocks: new Map(), id: undefined, model: undefined, beginUsage: {} };

  for await (const event of source) {
    yield* encodeEvent(state, event);

    if (event.type === 'message-end' || event.type === 'stream-error') return;
  }
}
