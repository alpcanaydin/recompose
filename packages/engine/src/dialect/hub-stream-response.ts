import type { HubBlockOpening, HubContentBlock, HubResponse, HubStreamEvent } from './hub';

import { parseToolArguments } from './hub-build';

type OpenBlock = {
  opening: HubBlockOpening;
  text: string;
  arguments: string;
  signature?: string;
};

type FoldState = {
  id: string | undefined;
  model: string | undefined;
  content: HubContentBlock[];
  blocks: Map<number, OpenBlock>;
  response: HubResponse | null;
};

function openedBlock(opening: HubBlockOpening): OpenBlock {
  return {
    opening,
    text: '',
    arguments: '',
    ...(opening.kind === 'tool' && opening.signature !== undefined
      ? { signature: opening.signature }
      : {}),
  };
}

function applyDelta(block: OpenBlock, event: Extract<HubStreamEvent, { type: 'block-delta' }>) {
  if (event.delta.kind === 'text' || event.delta.kind === 'thinking')
    block.text += event.delta.text;
  if (event.delta.kind === 'json-args') block.arguments += event.delta.partialJson;
  if (event.delta.kind === 'signature') block.signature = event.delta.signature;
}

function completedBlock(block: OpenBlock): HubContentBlock {
  if (block.opening.kind === 'text') return { type: 'text', text: block.text };

  return block.opening.kind === 'thinking' ? completedThinking(block) : completedTool(block);
}

function completedThinking(block: OpenBlock): HubContentBlock {
  return {
    type: 'thinking',
    text: block.text,
    ...(block.signature === undefined ? {} : { signature: block.signature }),
  };
}

function completedTool(block: OpenBlock): HubContentBlock {
  if (block.opening.kind !== 'tool') throw new Error('expected tool opening');

  return {
    type: 'tool_use',
    id: block.opening.id,
    name: block.opening.name,
    input: parseToolArguments(block.arguments === '' ? '{}' : block.arguments),
    ...(block.signature === undefined ? {} : { signature: block.signature }),
  };
}

function closeBlock(state: FoldState, index: number): void {
  const block = state.blocks.get(index);

  if (block === undefined) return;

  state.blocks.delete(index);
  state.content.push(completedBlock(block));
}

function applyBlockEvent(
  state: FoldState,
  event: Extract<HubStreamEvent, { type: 'block-open' | 'block-delta' | 'block-close' }>,
): void {
  if (event.type === 'block-open') {
    state.blocks.set(event.index, openedBlock(event.opening));

    return;
  }

  if (event.type === 'block-delta') {
    const block = state.blocks.get(event.index);

    if (block !== undefined) applyDelta(block, event);

    return;
  }

  closeBlock(state, event.index);
}

function completeResponse(
  state: FoldState,
  event: Extract<HubStreamEvent, { type: 'message-end' }>,
): void {
  state.response = {
    ...(state.id === undefined ? {} : { id: state.id }),
    ...(state.model === undefined ? {} : { model: state.model }),
    content: state.content,
    stopReason: event.stopReason,
    usage: event.usage,
  };
}

function applyEvent(state: FoldState, event: HubStreamEvent): void {
  if (event.type === 'message-begin') {
    state.id = event.id;
    state.model = event.model;

    return;
  }

  if (event.type === 'message-end') {
    completeResponse(state, event);

    return;
  }

  if (event.type === 'media') {
    state.content.push(event.block);

    return;
  }

  if (event.type !== 'stream-error') applyBlockEvent(state, event);
}

export async function collectHubResponse(
  source: AsyncIterable<HubStreamEvent>,
): Promise<HubResponse | null> {
  const state: FoldState = {
    id: undefined,
    model: undefined,
    content: [],
    blocks: new Map(),
    response: null,
  };

  for await (const event of source) {
    applyEvent(state, event);

    if (state.response !== null || event.type === 'stream-error') break;
  }

  return state.response;
}
