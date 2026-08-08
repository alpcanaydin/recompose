import type { HubStreamEvent } from './hub';

type BlockEvent = Extract<HubStreamEvent, { type: 'block-open' | 'block-delta' | 'block-close' }>;
type TerminalEvent = Extract<HubStreamEvent, { type: 'message-end' }>;

type SerializeState = {
  active: number | undefined;
  queued: number[];
  buffered: Map<number, BlockEvent[]>;
  wireIndices: Map<number, number>;
  nextWireIndex: number;
  terminal: TerminalEvent | undefined;
};

const BLOCK_EVENT_TYPES = new Set(['block-open', 'block-delta', 'block-close']);

function isBlockEvent(event: HubStreamEvent): event is BlockEvent {
  return BLOCK_EVENT_TYPES.has(event.type);
}

function wireIndex(state: SerializeState, sourceIndex: number): number {
  const existing = state.wireIndices.get(sourceIndex);

  if (existing !== undefined) return existing;

  const assigned = state.nextWireIndex;

  state.nextWireIndex += 1;
  state.wireIndices.set(sourceIndex, assigned);

  return assigned;
}

function remapped(state: SerializeState, event: BlockEvent): BlockEvent {
  return { ...event, index: wireIndex(state, event.index) };
}

function bufferedEvents(state: SerializeState, sourceIndex: number): BlockEvent[] {
  const existing = state.buffered.get(sourceIndex);

  if (existing !== undefined) return existing;

  const created: BlockEvent[] = [];

  state.buffered.set(sourceIndex, created);
  state.queued.push(sourceIndex);

  return created;
}

function terminalWhenReady(state: SerializeState): TerminalEvent[] {
  if (state.active !== undefined || state.queued.length > 0 || state.terminal === undefined) {
    return [];
  }

  const terminal = state.terminal;

  state.terminal = undefined;

  return [terminal];
}

function drainedBlock(state: SerializeState, sourceIndex: number): HubStreamEvent[] {
  const held = state.buffered.get(sourceIndex) ?? [];
  const closeAt = held.findIndex((event) => event.type === 'block-close');
  const drained = closeAt < 0 ? held : held.slice(0, closeAt + 1);

  state.buffered.delete(sourceIndex);
  state.active = closeAt < 0 ? sourceIndex : undefined;

  return drained.map((event) => remapped(state, event));
}

function drainQueued(state: SerializeState): HubStreamEvent[] {
  const emitted: HubStreamEvent[] = [];

  while (state.active === undefined && state.queued.length > 0) {
    const sourceIndex = state.queued.shift();

    if (sourceIndex !== undefined) emitted.push(...drainedBlock(state, sourceIndex));
  }

  return [...emitted, ...terminalWhenReady(state)];
}

function routeActiveBlock(state: SerializeState, event: BlockEvent): HubStreamEvent[] {
  const emitted: HubStreamEvent[] = [remapped(state, event)];

  if (event.type !== 'block-close') return emitted;

  state.active = undefined;

  return [...emitted, ...drainQueued(state)];
}

function routeBlock(state: SerializeState, event: BlockEvent): HubStreamEvent[] {
  if (state.active === undefined && state.queued.length === 0 && event.type === 'block-open') {
    state.active = event.index;

    return [remapped(state, event)];
  }

  if (event.index === state.active) return routeActiveBlock(state, event);

  bufferedEvents(state, event.index).push(event);

  return [];
}

function serializedEvent(state: SerializeState, event: HubStreamEvent): HubStreamEvent[] {
  if (isBlockEvent(event)) return routeBlock(state, event);

  if (event.type === 'stream-error') return [event];

  if (event.type === 'message-end') {
    state.terminal = event;

    return terminalWhenReady(state);
  }

  return [event];
}

export async function* serializeHubBlocks(
  source: AsyncIterable<HubStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  const state: SerializeState = {
    active: undefined,
    queued: [],
    buffered: new Map(),
    wireIndices: new Map(),
    nextWireIndex: 0,
    terminal: undefined,
  };

  for await (const event of source) {
    yield* serializedEvent(state, event);
  }
}
