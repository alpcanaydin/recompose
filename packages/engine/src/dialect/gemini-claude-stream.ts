import type { HubBlockOpening, HubStreamEvent } from './hub';

type Candidate = {
  events: HubStreamEvent[];
  hasText: boolean;
  index: number;
  signature: string | undefined;
};

type MergeState = {
  candidate: Candidate | undefined;
  kinds: Map<number, HubBlockOpening['kind']>;
  pendingThinking: number | undefined;
};

function pendingClose(state: MergeState): HubStreamEvent[] {
  const index = state.pendingThinking;

  if (index === undefined) return [];

  state.pendingThinking = undefined;

  return [{ type: 'block-close', index }];
}

function baseEvents(event: HubStreamEvent, state: MergeState): HubStreamEvent[] {
  if (event.type === 'block-open') {
    state.kinds.set(event.index, event.opening.kind);

    return [event];
  }

  if (event.type !== 'block-close') return [event];

  const kind = state.kinds.get(event.index);

  state.kinds.delete(event.index);

  if (kind !== 'thinking') return [event];

  state.pendingThinking = event.index;

  return [];
}

function beginCandidate(
  event: Extract<HubStreamEvent, { type: 'block-open' }>,
  state: MergeState,
): HubStreamEvent[] {
  state.candidate = { events: [event], hasText: false, index: event.index, signature: undefined };

  return [];
}

function finishCandidate(state: MergeState): HubStreamEvent[] {
  const candidate = state.candidate;

  if (candidate === undefined) return [];

  state.candidate = undefined;

  if (
    !candidate.hasText &&
    candidate.signature !== undefined &&
    state.pendingThinking !== undefined
  ) {
    const index = state.pendingThinking;

    return [
      { type: 'block-delta', index, delta: { kind: 'signature', signature: candidate.signature } },
      ...pendingClose(state),
    ];
  }

  return [
    ...pendingClose(state),
    ...candidate.events,
    { type: 'block-close', index: candidate.index },
  ];
}

function candidateEvents(event: HubStreamEvent, state: MergeState): HubStreamEvent[] {
  const candidate = state.candidate;

  if (candidate === undefined) return [];

  if (isCandidateDelta(event, candidate)) return recordCandidateDelta(event, candidate);
  if (isCandidateClose(event, candidate)) return closeCandidate(event, state);

  const flushed = finishCandidate(state);

  return [...flushed, ...normalizedEvents(event, state)];
}

function isCandidateDelta(
  event: HubStreamEvent,
  candidate: Candidate,
): event is Extract<HubStreamEvent, { type: 'block-delta' }> {
  return event.type === 'block-delta' && event.index === candidate.index;
}

function isCandidateClose(
  event: HubStreamEvent,
  candidate: Candidate,
): event is Extract<HubStreamEvent, { type: 'block-close' }> {
  return event.type === 'block-close' && event.index === candidate.index;
}

function recordCandidateDelta(
  event: Extract<HubStreamEvent, { type: 'block-delta' }>,
  candidate: Candidate,
): HubStreamEvent[] {
  candidate.events.push(event);

  if (event.delta.kind === 'text') candidate.hasText ||= event.delta.text !== '';
  if (event.delta.kind === 'signature') candidate.signature = event.delta.signature;

  return [];
}

function closeCandidate(
  event: Extract<HubStreamEvent, { type: 'block-close' }>,
  state: MergeState,
): HubStreamEvent[] {
  state.kinds.delete(event.index);

  return finishCandidate(state);
}

function normalizedEvents(event: HubStreamEvent, state: MergeState): HubStreamEvent[] {
  if (state.candidate !== undefined) return candidateEvents(event, state);

  if (state.pendingThinking !== undefined) {
    if (event.type === 'block-open' && event.opening.kind === 'text') {
      state.kinds.set(event.index, event.opening.kind);

      return beginCandidate(event, state);
    }

    return [...pendingClose(state), ...baseEvents(event, state)];
  }

  return baseEvents(event, state);
}

export async function* mergeGeminiThinkingSignature(
  source: AsyncIterable<HubStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  const state: MergeState = { candidate: undefined, kinds: new Map(), pendingThinking: undefined };

  for await (const event of source) yield* normalizedEvents(event, state);

  if (state.candidate !== undefined) yield* finishCandidate(state);
  yield* pendingClose(state);
}
