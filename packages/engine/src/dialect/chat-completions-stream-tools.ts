import type { ChatToolCallDelta } from './chat-completions-wire';
import type { HubStreamEvent } from './hub';

type PendingTool = {
  args: string;
  chatIndex: number;
  closed: boolean;
  hubIndex: number | undefined;
  id: string | undefined;
  name: string | undefined;
};

export type ChatToolDecodeState = {
  currentOpen: number | undefined;
  emittedToolCount: number;
  nextIndex: number;
  nextUnindexedTool: number;
  pendingTools: Map<number, PendingTool>;
  responseId: string | undefined;
  responsesTarget: boolean;
  syntheticIdCount: number;
};

export function initialToolState(): Pick<
  ChatToolDecodeState,
  'emittedToolCount' | 'pendingTools' | 'syntheticIdCount'
> {
  return { emittedToolCount: 0, pendingTools: new Map(), syntheticIdCount: 0 };
}

function toolName(delta: ChatToolCallDelta): string | undefined {
  const name: unknown = delta.function?.name;

  return typeof name === 'string' && name !== '' ? name : undefined;
}

function toolId(state: ChatToolDecodeState, id: string | undefined, chatIndex: number): string {
  if (id !== undefined && id !== '') return id;

  if (state.responsesTarget) {
    const choice = Math.floor(chatIndex / 1_000);
    const tool = chatIndex % 1_000;

    return `call_${state.responseId ?? 'chatcmpl'}_${String(choice)}_${String(tool)}`;
  }

  return `toolu_${state.syntheticIdCount++}`;
}

function openPendingTool(
  state: ChatToolDecodeState,
  pending: PendingTool,
  events: HubStreamEvent[],
  closeCurrent: () => void,
): void {
  closeCurrent();

  const hubIndex = state.nextIndex++;

  pending.hubIndex = hubIndex;
  state.currentOpen = hubIndex;
  state.emittedToolCount += 1;
  events.push({
    type: 'block-open',
    index: hubIndex,
    opening: {
      kind: 'tool',
      id: toolId(state, pending.id, pending.chatIndex),
      name: pending.name ?? '',
    },
  });
  flushArguments(pending, events);
}

function flushArguments(pending: PendingTool, events: HubStreamEvent[]): void {
  if (pending.args === '' || pending.hubIndex === undefined) return;

  events.push({
    type: 'block-delta',
    index: pending.hubIndex,
    delta: { kind: 'json-args', partialJson: pending.args },
  });
  pending.args = '';
}

function pendingTool(state: ChatToolDecodeState, chatIndex: number): PendingTool {
  const existing = state.pendingTools.get(chatIndex);

  if (existing !== undefined) return existing;

  const pending: PendingTool = {
    args: '',
    chatIndex,
    closed: false,
    hubIndex: undefined,
    id: undefined,
    name: undefined,
  };

  state.pendingTools.set(chatIndex, pending);

  return pending;
}

function updatePending(pending: PendingTool, delta: ChatToolCallDelta): string {
  updatePendingId(pending, delta.id);
  updatePendingName(pending, toolName(delta));

  return delta.function?.arguments ?? '';
}

function updatePendingId(pending: PendingTool, id: string | undefined): void {
  if (typeof id === 'string' && id !== '') pending.id = id;
}

function updatePendingName(pending: PendingTool, name: string | undefined): void {
  if (name !== undefined) pending.name = name;
}

function emitOpenDelta(pending: PendingTool, args: string, events: HubStreamEvent[]): boolean {
  if (pending.hubIndex === undefined || pending.closed || args === '') return false;

  events.push({
    type: 'block-delta',
    index: pending.hubIndex,
    delta: { kind: 'json-args', partialJson: args },
  });

  return true;
}

function applyToolDelta(
  state: ChatToolDecodeState,
  delta: ChatToolCallDelta,
  events: HubStreamEvent[],
  closeCurrent: () => void,
): void {
  const pending = pendingForDelta(state, delta);
  const args = updatePending(pending, delta);

  if (emitOpenDelta(pending, args, events)) return;

  pending.args += args;

  if (readyToOpen(pending)) {
    openPendingTool(state, pending, events, closeCurrent);
  }
}

function readyToOpen(pending: PendingTool): boolean {
  return pending.hubIndex === undefined && pending.id !== undefined && pending.name !== undefined;
}

function pendingForDelta(state: ChatToolDecodeState, delta: ChatToolCallDelta): PendingTool {
  if (delta.index !== undefined) return pendingTool(state, delta.index);

  const id = delta.id;

  return typeof id === 'string' && id !== '' ? pendingForId(state, id) : latestPending(state);
}

function pendingForId(state: ChatToolDecodeState, id: string): PendingTool {
  const matched = [...state.pendingTools.values()].find((pending) => pending.id === id);

  return matched ?? pendingTool(state, state.nextUnindexedTool++);
}

function latestPending(state: ChatToolDecodeState): PendingTool {
  const latest = [...state.pendingTools.values()].findLast((pending) => !pending.closed);

  return latest ?? pendingTool(state, state.nextUnindexedTool++);
}

export function applyToolCalls(
  state: ChatToolDecodeState,
  toolCalls: readonly ChatToolCallDelta[] | undefined,
  events: HubStreamEvent[],
  closeCurrent: () => void,
): void {
  for (const delta of toolCalls ?? []) applyToolDelta(state, delta, events, closeCurrent);
}

export function flushPendingTools(
  state: ChatToolDecodeState,
  events: HubStreamEvent[],
  closeCurrent: () => void,
): void {
  const pending = [...state.pendingTools.values()].toSorted(
    (left, right) => left.chatIndex - right.chatIndex,
  );

  for (const tool of pending) {
    if (tool.hubIndex === undefined && (tool.name !== undefined || state.responsesTarget)) {
      openPendingTool(state, tool, events, closeCurrent);
    }
  }
}

export function markToolsClosed(state: ChatToolDecodeState): void {
  for (const pending of state.pendingTools.values()) pending.closed = true;
}
