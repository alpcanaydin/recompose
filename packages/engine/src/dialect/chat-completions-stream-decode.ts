import type {
  ChatChunkChoice,
  ChatCompletionChunk,
  ChatStreamError,
  ChatStreamFrame,
} from './chat-completions-wire';
import type { HubStopReason, HubStreamEvent, HubUsage } from './hub';

import { hubStopFrom } from './chat-completions-stops';
import {
  applyToolCalls,
  flushPendingTools,
  initialToolState,
  markToolsClosed,
  type ChatToolDecodeState,
} from './chat-completions-stream-tools';
import { hubUsageFromChat } from './chat-completions-usage';

type DecodeState = ChatToolDecodeState & {
  begun: boolean;
  nextIndex: number;
  currentOpen: number | undefined;
  textIndex: number | undefined;
  stopReason: HubStopReason;
  usage: HubUsage;
};

function initialDecodeState(responsesTarget: boolean): DecodeState {
  return {
    begun: false,
    nextIndex: 0,
    nextUnindexedTool: 0,
    responseId: undefined,
    responsesTarget,
    currentOpen: undefined,
    textIndex: undefined,
    ...initialToolState(),
    stopReason: 'end',
    usage: {},
  };
}

function forgetClosedBlock(state: DecodeState, closedIndex: number): void {
  if (state.textIndex === closedIndex) {
    state.textIndex = undefined;
  }
}

function closeCurrent(state: DecodeState, events: HubStreamEvent[]): void {
  if (state.currentOpen !== undefined) {
    events.push({ type: 'block-close', index: state.currentOpen });
    forgetClosedBlock(state, state.currentOpen);
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

function applyFinish(state: DecodeState, finishReason: ChatChunkChoice['finish_reason']): void {
  if (finishReason === undefined || finishReason === null) {
    return;
  }

  const mapped = hubStopFrom(finishReason);

  state.stopReason = mapped === 'tool_use' && state.emittedToolCount === 0 ? 'end' : mapped;
}

function ensureBegun(
  state: DecodeState,
  events: HubStreamEvent[],
  chunk: ChatCompletionChunk,
): void {
  if (state.begun) {
    return;
  }

  state.begun = true;
  state.responseId = chunk.id;
  events.push({
    type: 'message-begin',
    ...(chunk.id === undefined ? {} : { id: chunk.id }),
    ...(chunk.model === undefined ? {} : { model: chunk.model }),
  });
}

function applyChoice(state: DecodeState, choice: ChatChunkChoice, events: HubStreamEvent[]): void {
  applyContent(state, choice.delta.content, events);

  const close = (): void => {
    closeCurrent(state, events);
  };

  applyToolCalls(state, choiceToolCalls(choice), events, close);

  if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
    flushPendingTools(state, events, close);
    applyFinish(state, choice.finish_reason);
    closeCurrent(state, events);
    markToolsClosed(state);
  }
}

function choiceToolCalls(choice: ChatChunkChoice) {
  return choice.delta.tool_calls?.map((call) =>
    call.index === undefined ? call : { ...call, index: choice.index * 1_000 + call.index },
  );
}

function decodeChunk(
  state: DecodeState,
  chunk: ChatCompletionChunk,
  events: HubStreamEvent[],
): void {
  ensureBegun(state, events, chunk);

  for (const choice of chunk.choices) applyChoice(state, choice, events);

  if (chunk.usage !== undefined && chunk.usage !== null) {
    state.usage = hubUsageFromChat(chunk.usage);
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
  responsesTarget = false,
): AsyncIterable<HubStreamEvent> {
  const state = initialDecodeState(responsesTarget);

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

export function decodeStreamForResponses(
  frames: AsyncIterable<ChatStreamFrame>,
): AsyncIterable<HubStreamEvent> {
  return decodeStream(frames, true);
}
