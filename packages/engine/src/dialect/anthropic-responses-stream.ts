import type { HubStreamEvent } from './hub';

type MergeState = {
  aliases: Map<number, number>;
  pendingTextIndex: number | undefined;
};

function flushPending(state: MergeState): HubStreamEvent[] {
  const index = state.pendingTextIndex;

  if (index === undefined) return [];

  state.aliases.clear();
  state.pendingTextIndex = undefined;

  return [{ type: 'block-close', index }];
}

function openEvents(
  event: Extract<HubStreamEvent, { type: 'block-open' }>,
  state: MergeState,
): HubStreamEvent[] {
  if (event.opening.kind !== 'text') return [...flushPending(state), event];

  const pending = state.pendingTextIndex;

  if (pending === undefined) {
    state.pendingTextIndex = event.index;
    state.aliases.set(event.index, event.index);

    return [event];
  }

  state.aliases.set(event.index, pending);

  return [];
}

function blockEvents(event: HubStreamEvent, state: MergeState): HubStreamEvent[] {
  if (event.type === 'block-open') return openEvents(event, state);
  if (event.type === 'block-delta') return deltaEvents(event, state);
  if (event.type === 'block-close') return closeEvents(event, state);

  return [event];
}

function deltaEvents(
  event: Extract<HubStreamEvent, { type: 'block-delta' }>,
  state: MergeState,
): HubStreamEvent[] {
  const alias = state.aliases.get(event.index);

  if (alias === undefined) return [event];

  return [{ ...event, index: alias }];
}

function closeEvents(
  event: Extract<HubStreamEvent, { type: 'block-close' }>,
  state: MergeState,
): HubStreamEvent[] {
  return state.aliases.has(event.index) ? [] : [event];
}

function normalizedEvents(event: HubStreamEvent, state: MergeState): HubStreamEvent[] {
  if (event.type === 'message-end' || event.type === 'stream-error') {
    return [...flushPending(state), event];
  }

  return blockEvents(event, state);
}

export async function* mergeAnthropicResponseText(
  source: AsyncIterable<HubStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  const state: MergeState = { aliases: new Map(), pendingTextIndex: undefined };

  for await (const event of source) yield* normalizedEvents(event, state);

  yield* flushPending(state);
}
