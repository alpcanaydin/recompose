import type { JsonObject } from '../gateway-wire';
import type { ReplayTurn } from './codex-replay-turns';

import { isCodexReasoningSignature } from '../dialect/responses-shared';
import { isJsonObject } from '../gateway-wire';
import { boundedCodexCallId } from './codex-identities';
import { codexReplayPrefixFingerprint } from './codex-replay-turns';

function assistantText(value: unknown): string | undefined {
  if (!isJsonObject(value) || value['type'] !== 'message' || value['role'] !== 'assistant') {
    return undefined;
  }

  const text = contentText(value['content']);

  return text === '' ? undefined : text;
}

function contentText(value: unknown): string {
  if (typeof value === 'string') return value;

  return Array.isArray(value) ? value.flatMap(textPart).join('') : '';
}

function textPart(value: unknown): string[] {
  return isJsonObject(value) && typeof value['text'] === 'string' ? [value['text']] : [];
}

function callId(value: unknown, types = ['function_call', 'custom_tool_call']): string | undefined {
  if (!isJsonObject(value) || !types.includes(String(value['type']))) return undefined;

  return typeof value['call_id'] === 'string' ? value['call_id'] : undefined;
}

function comparableCallIds(id: string): string[] {
  const bounded = boundedCodexCallId(id);

  return typeof bounded === 'string' && bounded !== id ? [id, bounded] : [id];
}

function sharesCallId(left: string, right: string): boolean {
  const rightIds = new Set(comparableCallIds(right));

  return comparableCallIds(left).some((candidate) => rightIds.has(candidate));
}

function itemMatchesTurn(value: unknown, turn: ReplayTurn): boolean {
  const text = assistantText(value);
  const id = callId(value, [
    'function_call',
    'custom_tool_call',
    'function_call_output',
    'custom_tool_call_output',
  ]);

  return (
    (turn.assistantText !== undefined && text === turn.assistantText) ||
    (id !== undefined && turn.callIds.some((candidate) => sharesCallId(candidate, id)))
  );
}

function hasValidClientReasoning(input: readonly unknown[]): boolean {
  return input.some((item) => {
    const signature = isJsonObject(item) ? item['encrypted_content'] : undefined;

    return (
      itemType(item) === 'reasoning' &&
      typeof signature === 'string' &&
      isCodexReasoningSignature(signature)
    );
  });
}

function itemType(value: unknown): unknown {
  return isJsonObject(value) ? value['type'] : undefined;
}

function matchingOutputId(input: readonly unknown[], id: string): string | undefined {
  return input
    .map((item) => callId(item, ['function_call_output', 'custom_tool_call_output']))
    .find((candidate) => candidate !== undefined && sharesCallId(id, candidate));
}

function existingReasoning(input: readonly unknown[]): Set<string> {
  return new Set(
    input.flatMap((item) => {
      const signature = isJsonObject(item) ? item['encrypted_content'] : undefined;

      return typeof signature === 'string' ? [signature] : [];
    }),
  );
}

function missingCalls(input: readonly unknown[], turn: ReplayTurn): JsonObject[] {
  return turn.calls.flatMap((item) => {
    const id = callId(item);
    const outputId = id === undefined ? undefined : matchingOutputId(input, id);
    const existing =
      id === undefined
        ? undefined
        : input.map((value) => callId(value)).find((value) => value === id);

    return outputId === undefined || existing !== undefined ? [] : [{ ...item, call_id: outputId }];
  });
}

function missingTurnItems(input: readonly unknown[], turn: ReplayTurn): JsonObject[] {
  const signatures = existingReasoning(input);
  const reasoning = turn.reasoning.filter(
    (item) => !signatures.has(String(item['encrypted_content'])),
  );

  return [...reasoning, ...missingCalls(input, turn)];
}

function defaultInsertIndex(input: readonly unknown[]): number {
  const assistant = input.findLastIndex((item) => assistantText(item) !== undefined);

  if (assistant >= 0) return assistant;

  const first = input.findIndex(
    (item) => !['system', 'developer'].includes(String(isJsonObject(item) ? item['role'] : '')),
  );

  return first < 0 ? input.length : first;
}

function prefixMatches(input: readonly unknown[], index: number, turn: ReplayTurn): boolean {
  return (
    turn.requestFingerprint === undefined ||
    codexReplayPrefixFingerprint(input, index) === turn.requestFingerprint
  );
}

function eligibleAnchor(
  input: readonly unknown[],
  turn: ReplayTurn,
  index: number,
  used: ReadonlySet<number>,
  requirePrefix: boolean,
): boolean {
  if (used.has(index) || !itemMatchesTurn(input[index], turn)) return false;

  return !requirePrefix || prefixMatches(input, index, turn);
}

function matchingAnchors(
  input: readonly unknown[],
  turn: ReplayTurn,
  searchEnd: number,
  used: ReadonlySet<number>,
  requirePrefix: boolean,
): number[] {
  const matches: number[] = [];

  for (let index = searchEnd; index >= 0; index -= 1) {
    if (eligibleAnchor(input, turn, index, used, requirePrefix)) matches.push(index);
  }

  return matches;
}

function matchingAnchor(
  input: readonly unknown[],
  turn: ReplayTurn,
  searchEnd: number,
  used: ReadonlySet<number>,
): number {
  const exact = matchingAnchors(input, turn, searchEnd, used, true);

  return exact[0] ?? uniqueFallbackAnchor(input, turn, searchEnd, used);
}

function uniqueFallbackAnchor(
  input: readonly unknown[],
  turn: ReplayTurn,
  searchEnd: number,
  used: ReadonlySet<number>,
): number {
  if (turn.requestFingerprint === undefined) return -1;

  const fallback = matchingAnchors(input, turn, searchEnd, used, false);

  return fallback.length === 1 ? (fallback[0] ?? -1) : -1;
}

type InsertState = {
  fallbackEnd: number;
  insertions: Map<number, JsonObject[]>;
  used: Set<number>;
};

function turnAnchor(input: readonly unknown[], turn: ReplayTurn, state: InsertState): number {
  if (turn.callIds.length === 0 && turn.assistantText === undefined)
    return defaultInsertIndex(input);

  const end = turn.requestFingerprint === undefined ? state.fallbackEnd : input.length - 1;

  return matchingAnchor(input, turn, end, state.used);
}

function applyTurn(input: readonly unknown[], turn: ReplayTurn, state: InsertState): void {
  const at = turnAnchor(input, turn, state);

  if (at < 0) return;

  const items = missingTurnItems(input, turn);

  if (items.length === 0) return;

  state.insertions.set(at, [...items, ...(state.insertions.get(at) ?? [])]);
  state.used.add(at);
  if (turn.requestFingerprint === undefined) state.fallbackEnd = at - 1;
}

export function insertReplayTurns(input: unknown[], turns: readonly ReplayTurn[]): unknown[] {
  if (hasValidClientReasoning(input)) return input;

  const state: InsertState = {
    fallbackEnd: input.length - 1,
    insertions: new Map(),
    used: new Set(),
  };

  for (const turn of turns.toReversed()) applyTurn(input, turn, state);

  return input.flatMap((item, index) => [...(state.insertions.get(index) ?? []), item]);
}
