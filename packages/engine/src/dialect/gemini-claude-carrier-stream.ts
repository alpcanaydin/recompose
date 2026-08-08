import type { HubBlockDelta, HubBlockOpening, HubStreamEvent } from './hub';

import { encodeGeminiClaudeCarrier } from '../provider/gemini-claude-carrier';
import { isGeminiBypass, nativeGeminiSignature } from '../provider/gemini-signature';

type Block = {
  opening: HubBlockOpening;
  deltas: HubBlockDelta[];
};

type State = {
  block?: Block;
  nextIndex: number;
  lastTarget?: 'text' | 'function';
};

function nativeSignature(block: Block): string | null {
  const delta = block.deltas.find((value) => value.kind === 'signature');
  const value = delta?.kind === 'signature' ? delta.signature : block.opening.signature;
  const signature = nativeGeminiSignature(value);

  return signature === null || isGeminiBypass(signature) ? null : signature;
}

function targetOf(opening: HubBlockOpening): 'text' | 'function' {
  return opening.kind === 'tool' ? 'function' : 'text';
}

function hasText(block: Block): boolean {
  return block.deltas.some(
    (delta) => (delta.kind === 'text' || delta.kind === 'thinking') && delta.text !== '',
  );
}

function carrierEvents(
  state: State,
  signature: string,
  direction: 'next' | 'previous',
  target: 'text' | 'function',
): HubStreamEvent[] {
  const index = state.nextIndex;
  const envelope = encodeGeminiClaudeCarrier({ signature, direction, target });

  state.nextIndex += 1;

  return [
    { type: 'block-open', index, opening: { kind: 'thinking', signature: envelope } },
    { type: 'block-delta', index, delta: { kind: 'thinking', text: '' } },
    { type: 'block-delta', index, delta: { kind: 'signature', signature: envelope } },
    { type: 'block-close', index },
  ];
}

function targetEvents(state: State, block: Block, stripSignature = false): HubStreamEvent[] {
  const index = state.nextIndex;
  const opening = stripSignature ? withoutSignature(block.opening) : block.opening;
  const deltas = stripSignature
    ? block.deltas.filter((delta) => delta.kind !== 'signature')
    : block.deltas;

  state.nextIndex += 1;
  state.lastTarget = targetOf(opening);

  return [
    { type: 'block-open', index, opening },
    ...deltas.map((delta): HubStreamEvent => ({ type: 'block-delta', index, delta })),
    { type: 'block-close', index },
  ];
}

function withoutSignature(opening: HubBlockOpening): HubBlockOpening {
  const { signature: _signature, ...rest } = opening;

  return rest;
}

function completedBlock(state: State, block: Block): HubStreamEvent[] {
  const signature = nativeSignature(block);

  if (signature === null) return targetEvents(state, block);

  return signedBlockEvents(state, block, signature);
}

function signedBlockEvents(state: State, block: Block, signature: string): HubStreamEvent[] {
  const detached = detachedCarrierEvents(state, block, signature);

  if (detached !== null) return detached;

  const target = targetOf(block.opening);

  return [...carrierEvents(state, signature, 'next', target), ...targetEvents(state, block, true)];
}

function detachedCarrierEvents(
  state: State,
  block: Block,
  signature: string,
): HubStreamEvent[] | null {
  if (block.opening.kind !== 'text' || hasText(block)) return null;

  const direction = state.lastTarget === undefined ? 'next' : 'previous';
  const target = state.lastTarget ?? targetOf(block.opening);

  return carrierEvents(state, signature, direction, target);
}

function passthrough(event: HubStreamEvent, state: State): HubStreamEvent[] {
  if (event.type === 'message-begin') {
    state.nextIndex = 0;
    delete state.lastTarget;
  }

  return [event];
}

function transformed(event: HubStreamEvent, state: State): HubStreamEvent[] {
  if (state.block !== undefined) return blockEvent(event, state);
  if (event.type !== 'block-open') return passthrough(event, state);

  state.block = { opening: event.opening, deltas: [] };

  return [];
}

function blockEvent(event: HubStreamEvent, state: State): HubStreamEvent[] {
  const block = state.block;

  if (block === undefined) return [];

  if (event.type === 'block-delta') {
    block.deltas.push(event.delta);

    return [];
  }

  if (event.type !== 'block-close') return [];

  delete state.block;

  return completedBlock(state, block);
}

export async function* geminiClaudeCarrierStream(
  source: AsyncIterable<HubStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  const state: State = { nextIndex: 0 };

  for await (const event of source) yield* transformed(event, state);
}
