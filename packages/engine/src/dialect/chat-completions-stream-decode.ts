import type {
  ChatChunkChoice,
  ChatCompletionChunk,
  ChatStreamError,
  ChatStreamFrame,
  ChatToolCallDelta,
} from './chat-completions-wire';
import type { HubStopReason, HubStreamEvent, HubUsage } from './hub';

import { hubStopFrom } from './chat-completions-stops';

type DecodeState = {
  begun: boolean;
  nextIndex: number;
  currentOpen: number | undefined;
  textIndex: number | undefined;
  toolIndexMap: Map<number, number>;
  syntheticIdCount: number;
  stopReason: HubStopReason;
  usage: HubUsage;
};

function initialDecodeState(): DecodeState {
  return {
    begun: false,
    nextIndex: 0,
    currentOpen: undefined,
    textIndex: undefined,
    toolIndexMap: new Map(),
    syntheticIdCount: 0,
    stopReason: 'end',
    usage: {},
  };
}

function closeCurrent(state: DecodeState, events: HubStreamEvent[]): void {
  if (state.currentOpen !== undefined) {
    events.push({ type: 'block-close', index: state.currentOpen });
    state.currentOpen = undefined;
  }
}

function openText(state: DecodeState, events: HubStreamEvent[]): number {
  if (state.textIndex !== undefined) {
    return state.textIndex;
  }

  closeCurrent(state, events);

  const index = state.nextIndex++;

  state.textIndex = index;
  state.currentOpen = index;
  events.push({ type: 'block-open', index, opening: { kind: 'text' } });

  return index;
}

function applyContent(
  state: DecodeState,
  content: string | null | undefined,
  events: HubStreamEvent[],
): void {
  if (typeof content !== 'string' || content === '') {
    return;
  }

  const index = openText(state, events);

  events.push({ type: 'block-delta', index, delta: { kind: 'text', text: content } });
}

function toolName(delta: ChatToolCallDelta): string | undefined {
  const name = delta.function?.name;

  return name !== undefined && name !== '' ? name : undefined;
}

function toolId(state: DecodeState, delta: ChatToolCallDelta): string {
  if (delta.id !== undefined && delta.id !== '') {
    return delta.id;
  }

  return `toolu_${state.syntheticIdCount++}`;
}

function openToolBlock(
  state: DecodeState,
  chatIndex: number,
  delta: ChatToolCallDelta,
  events: HubStreamEvent[],
): number {
  const existing = state.toolIndexMap.get(chatIndex);

  if (existing !== undefined) {
    return existing;
  }

  closeCurrent(state, events);

  const hubIndex = state.nextIndex++;

  state.toolIndexMap.set(chatIndex, hubIndex);
  state.currentOpen = hubIndex;
  events.push({
    type: 'block-open',
    index: hubIndex,
    opening: {
      kind: 'tool',
      id: toolId(state, delta),
      name: toolName(delta) ?? `tool_${hubIndex}`,
    },
  });

  return hubIndex;
}

function applyToolDelta(
  state: DecodeState,
  delta: ChatToolCallDelta,
  events: HubStreamEvent[],
): void {
  const hubIndex = openToolBlock(state, delta.index ?? -1, delta, events);
  const args = delta.function?.arguments;

  if (args !== undefined && args !== '') {
    events.push({
      type: 'block-delta',
      index: hubIndex,
      delta: { kind: 'json-args', partialJson: args },
    });
  }
}

function applyToolCalls(
  state: DecodeState,
  toolCalls: readonly ChatToolCallDelta[] | undefined,
  events: HubStreamEvent[],
): void {
  for (const delta of toolCalls ?? []) {
    applyToolDelta(state, delta, events);
  }
}

function applyFinish(state: DecodeState, finishReason: ChatChunkChoice['finish_reason']): void {
  if (finishReason === undefined || finishReason === null) {
    return;
  }

  state.stopReason = hubStopFrom(finishReason);
}

function ensureBegun(state: DecodeState, events: HubStreamEvent[]): void {
  if (state.begun) {
    return;
  }

  state.begun = true;
  events.push({ type: 'message-begin' });
}

function applyChoice(state: DecodeState, choice: ChatChunkChoice, events: HubStreamEvent[]): void {
  applyContent(state, choice.delta.content, events);
  applyToolCalls(state, choice.delta.tool_calls, events);
  applyFinish(state, choice.finish_reason);
}

function decodeChunk(
  state: DecodeState,
  chunk: ChatCompletionChunk,
  events: HubStreamEvent[],
): void {
  ensureBegun(state, events);

  const choice = chunk.choices[0];

  if (choice !== undefined) {
    applyChoice(state, choice, events);
  }

  if (chunk.usage !== undefined && chunk.usage !== null) {
    state.usage = {
      inputTokens: chunk.usage.prompt_tokens,
      outputTokens: chunk.usage.completion_tokens,
    };
  }
}

function closeAndEnd(state: DecodeState, events: HubStreamEvent[]): void {
  closeCurrent(state, events);
  events.push({ type: 'message-end', stopReason: state.stopReason, usage: state.usage });
}

function streamErrorEvent(error: ChatStreamError): HubStreamEvent {
  return { type: 'stream-error', error: { type: error.type ?? 'error', message: error.message } };
}

function decodeFrame(
  state: DecodeState,
  frame: ChatStreamFrame,
  events: HubStreamEvent[],
): boolean {
  switch (frame.type) {
    case 'chunk':
      decodeChunk(state, frame.chunk, events);

      return false;
    case 'error':
      events.push(streamErrorEvent(frame.error));

      return true;
    case 'done':
      closeAndEnd(state, events);

      return true;
    case 'unknown':
      return false;

    default: {
      const unknownFrame: never = frame;

      throw new Error(`decodeStream met an unknown frame: ${JSON.stringify(unknownFrame)}`);
    }
  }
}

export async function* decodeStream(
  frames: AsyncIterable<ChatStreamFrame>,
): AsyncIterable<HubStreamEvent> {
  const state = initialDecodeState();

  for await (const frame of frames) {
    const events: HubStreamEvent[] = [];
    const done = decodeFrame(state, frame, events);

    for (const event of events) {
      yield event;
    }

    if (done) {
      return;
    }
  }
}
