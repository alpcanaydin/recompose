import type { ChatFinishReason, ChatStreamFrame } from './chat-completions-wire';
import type { HubBlockDelta, HubBlockOpening, HubStreamEvent, HubUsage } from './hub';

import { chatFinishFrom } from './chat-completions-stops';
import { chatIdentityFrame } from './chat-completions-stream-identity';
import { streamErrorFromRefusal, usageChunk } from './chat-completions-stream-terminal';
import { mergedStreamUsage } from './chat-completions-usage';

type EncodeState = {
  toolChatIndex: Map<number, number>;
  toolCounter: number;
  beginUsage: HubUsage;
  id: string | undefined;
  model: string | undefined;
};

type ToolOpening = Extract<HubBlockOpening, { kind: 'tool' }>;
type BlockOpenEvent = Extract<HubStreamEvent, { type: 'block-open' }>;
type BlockDeltaEvent = Extract<HubStreamEvent, { type: 'block-delta' }>;
type MessageEndEvent = Extract<HubStreamEvent, { type: 'message-end' }>;
type ActiveEvent = Extract<
  HubStreamEvent,
  { type: 'block-open' | 'block-delta' | 'media' | 'message-end' | 'stream-error' }
>;

function initialEncodeState(): EncodeState {
  return {
    toolChatIndex: new Map(),
    toolCounter: 0,
    beginUsage: {},
    id: undefined,
    model: undefined,
  };
}

function beginChunk(): ChatStreamFrame {
  return {
    type: 'chunk',
    chunk: { choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] },
  };
}

function contentChunk(text: string): ChatStreamFrame {
  return {
    type: 'chunk',
    chunk: { choices: [{ index: 0, delta: { content: text }, finish_reason: null }] },
  };
}

function argsChunk(state: EncodeState, hubIndex: number, partialJson: string): ChatStreamFrame {
  const chatIndex = state.toolChatIndex.get(hubIndex) ?? 0;

  return {
    type: 'chunk',
    chunk: {
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: chatIndex, function: { arguments: partialJson } }] },
          finish_reason: null,
        },
      ],
    },
  };
}

function openToolChunk(
  state: EncodeState,
  hubIndex: number,
  opening: ToolOpening,
  frames: ChatStreamFrame[],
): void {
  const chatIndex = state.toolCounter++;

  state.toolChatIndex.set(hubIndex, chatIndex);
  frames.push({
    type: 'chunk',
    chunk: {
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              { index: chatIndex, id: opening.id, function: { name: opening.name, arguments: '' } },
            ],
          },
          finish_reason: null,
        },
      ],
    },
  });
}

function encodeBlockOpen(
  state: EncodeState,
  event: BlockOpenEvent,
  frames: ChatStreamFrame[],
): void {
  switch (event.opening.kind) {
    case 'text':
      return;
    case 'thinking':
      return;
    case 'tool':
      openToolChunk(state, event.index, event.opening, frames);

      return;

    default: {
      const unknownOpening: never = event.opening;

      throw new Error(
        `encodeStream met an unknown block opening: ${JSON.stringify(unknownOpening)}`,
      );
    }
  }
}

function encodeBlockDelta(
  state: EncodeState,
  event: BlockDeltaEvent,
  frames: ChatStreamFrame[],
): void {
  if (event.delta.kind === 'annotation') return;

  encodeStandardBlockDelta(state, event.index, event.delta, frames);
}

function encodeStandardBlockDelta(
  state: EncodeState,
  index: number,
  delta: Exclude<HubBlockDelta, { kind: 'annotation' }>,
  frames: ChatStreamFrame[],
): void {
  switch (delta.kind) {
    case 'text':
      frames.push(contentChunk(delta.text));

      return;
    case 'json-args':
      frames.push(argsChunk(state, index, delta.partialJson));

      return;
    case 'thinking':
    case 'signature':
      return;

    default: {
      const unknownDelta: never = delta;

      throw new Error(`encodeStream met an unknown block delta: ${JSON.stringify(unknownDelta)}`);
    }
  }
}

function finishChunk(finish: ChatFinishReason, native: string | undefined): ChatStreamFrame {
  return {
    type: 'chunk',
    chunk: {
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: finish,
          ...(native === undefined ? {} : { native_finish_reason: native }),
        },
      ],
    },
  };
}

function mediaChunk(event: Extract<HubStreamEvent, { type: 'media' }>): ChatStreamFrame[] {
  if (event.block.type !== 'image') return [];

  const source = event.block.source;
  const url = source.type === 'url' ? source.url : `data:${source.mediaType};base64,${source.data}`;

  return [
    {
      type: 'chunk',
      chunk: {
        choices: [
          {
            index: 0,
            delta: { images: [{ type: 'image_url', image_url: { url } }] },
            finish_reason: null,
          },
        ],
      },
    },
  ];
}

function encodeMessageEnd(
  state: EncodeState,
  event: MessageEndEvent,
  frames: ChatStreamFrame[],
): void {
  const finish = chatFinishFrom(event.stopReason);

  if ('refusal' in finish) {
    frames.push({ type: 'error', error: streamErrorFromRefusal(finish.refusal) });

    return;
  }

  frames.push(finishChunk(finish.finish, event.nativeStopReason));
  frames.push(usageChunk(mergedStreamUsage(state.beginUsage, event.usage)));
  frames.push({ type: 'done' });
}

function encodeActiveEvent(
  state: EncodeState,
  event: ActiveEvent,
  frames: ChatStreamFrame[],
): boolean {
  if (event.type === 'media') {
    frames.push(...mediaChunk(event));

    return false;
  }

  return encodeStandardActiveEvent(state, event, frames);
}

function encodeStandardActiveEvent(
  state: EncodeState,
  event: Exclude<ActiveEvent, { type: 'media' }>,
  frames: ChatStreamFrame[],
): boolean {
  switch (event.type) {
    case 'block-open':
      encodeBlockOpen(state, event, frames);

      return false;
    case 'block-delta':
      encodeBlockDelta(state, event, frames);

      return false;
    case 'message-end':
      encodeMessageEnd(state, event, frames);

      return true;
    case 'stream-error':
      frames.push({ type: 'error', error: event.error });

      return true;

    default: {
      const unknownEvent: never = event;

      throw new Error(`encodeStream met an unknown event: ${JSON.stringify(unknownEvent)}`);
    }
  }
}

function encodeEvent(
  state: EncodeState,
  event: HubStreamEvent,
  frames: ChatStreamFrame[],
): boolean {
  if (event.type === 'message-begin') {
    state.beginUsage = event.usage ?? {};
    state.id = event.id;
    state.model = event.model;
    frames.push(beginChunk());

    return false;
  }

  if (event.type === 'block-close') {
    return false;
  }

  return encodeActiveEvent(state, event, frames);
}

export async function* encodeStream(
  events: AsyncIterable<HubStreamEvent>,
): AsyncIterable<ChatStreamFrame> {
  const state = initialEncodeState();

  for await (const event of events) {
    const frames: ChatStreamFrame[] = [];
    const done = encodeEvent(state, event, frames);

    for (const frame of frames) {
      yield chatIdentityFrame(frame, state.id, state.model);
    }

    if (done) {
      return;
    }
  }
}
