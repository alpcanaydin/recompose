import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { nativeGeminiSignature } from './antigravity-signature-envelope';
import { canonicalJson } from './canonical-json';

export type AntigravityReplayItem = {
  id: string;
  name: string;
  args: JsonObject;
  signature?: string;
  occurrence?: number;
  text?: string;
  thought?: boolean;
};

function functionCall(part: unknown): JsonObject | null {
  if (!isJsonObject(part)) return null;

  return isJsonObject(part['functionCall']) ? part['functionCall'] : null;
}

function stringField(value: JsonObject, key: string): string {
  return typeof value[key] === 'string' ? value[key].trim() : '';
}

function directSignature(part: JsonObject): string | undefined {
  for (const key of ['thoughtSignature', 'thought_signature']) {
    const signature = nativeGeminiSignature(part[key]);

    if (signature !== null) return signature;
  }

  return undefined;
}

function replayItem(part: JsonObject, prefix: string | undefined): AntigravityReplayItem | null {
  const call = functionCall(part);

  if (call === null) return null;

  const args = isJsonObject(call['args']) ? call['args'] : {};
  const signature = itemSignature(part, call, prefix);

  return {
    id: stringField(call, 'id'),
    name: stringField(call, 'name'),
    args,
    ...(signature === undefined ? {} : { signature }),
  };
}

function itemSignature(
  part: JsonObject,
  call: JsonObject,
  prefix: string | undefined,
): string | undefined {
  return directSignature(part) ?? directSignature(call) ?? prefix;
}

function detachedSignature(part: JsonObject): string | undefined {
  return functionCall(part) === null ? directSignature(part) : undefined;
}

export type AntigravityReplayScan = {
  items: AntigravityReplayItem[];
  pendingSignature?: string;
};

type MutableReplayScan = { items: AntigravityReplayItem[]; prefix?: string };

function attachDetachedSignature(items: AntigravityReplayItem[], signature: string): boolean {
  const last = items.at(-1);

  if (last === undefined || last.signature !== undefined) return false;

  items[items.length - 1] = { ...last, signature };

  return true;
}

export function scanReplayParts(
  parts: unknown[],
  pendingSignature?: string,
): AntigravityReplayScan {
  const scan: MutableReplayScan = {
    items: [],
    ...(pendingSignature === undefined ? {} : { prefix: pendingSignature }),
  };

  for (const value of parts) {
    scanReplayPart(scan, value);
  }

  return {
    items: scan.items,
    ...(scan.prefix === undefined ? {} : { pendingSignature: scan.prefix }),
  };
}

function scanReplayPart(scan: MutableReplayScan, value: unknown): void {
  if (!isJsonObject(value)) return;

  captureDetached(scan, detachedSignature(value));

  const item = replayItem(value, scan.prefix);

  if (item === null) return;

  scan.items.push(withOccurrence(item, scan.items));
  delete scan.prefix;
}

function withOccurrence(
  item: AntigravityReplayItem,
  existing: AntigravityReplayItem[],
): AntigravityReplayItem {
  if (item.id !== '') return item;

  const key = functionCallKey(item.name, item.args);
  const occurrence = existing.filter(
    (candidate) => candidate.id === '' && functionCallKey(candidate.name, candidate.args) === key,
  ).length;

  return { ...item, occurrence };
}

function captureDetached(scan: MutableReplayScan, signature: string | undefined): void {
  if (signature === undefined) return;

  if (attachDetachedSignature(scan.items, signature)) delete scan.prefix;
  else scan.prefix = signature;
}

function sameIdentity(left: AntigravityReplayItem, right: AntigravityReplayItem): boolean {
  if (hasTextIdentity(left, right)) return sameTextIdentity(left, right);
  if (left.id !== '' && right.id !== '') return left.id === right.id;

  return (
    functionCallKey(left.name, left.args) === functionCallKey(right.name, right.args) &&
    left.occurrence === right.occurrence
  );
}

function hasTextIdentity(left: AntigravityReplayItem, right: AntigravityReplayItem): boolean {
  return left.text !== undefined || right.text !== undefined;
}

function sameTextIdentity(left: AntigravityReplayItem, right: AntigravityReplayItem): boolean {
  return (
    left.text === right.text &&
    left.thought === right.thought &&
    left.occurrence === right.occurrence
  );
}

export function mergedReplayItems(
  current: AntigravityReplayItem[],
  incoming: AntigravityReplayItem[],
): AntigravityReplayItem[] {
  const merged = [...current];

  for (const item of incoming) {
    const index = merged.findIndex((candidate) => sameIdentity(candidate, item));

    if (index < 0) merged.push(item);
    else merged[index] = { ...merged[index], ...item };
  }

  return merged;
}

export function matchesResponse(item: AntigravityReplayItem, response: JsonObject): boolean {
  if (item.text !== undefined) return false;

  return matchesFunctionResponse(item, response);
}

function matchesFunctionResponse(item: AntigravityReplayItem, response: JsonObject): boolean {
  const id = stringField(response, 'id');
  const name = stringField(response, 'name');

  if (id !== '' && item.id !== '') return id === item.id;

  return name !== '' && name !== 'unknown' && item.name === name;
}

export function matchesCall(
  item: AntigravityReplayItem,
  call: JsonObject,
  occurrence = 0,
): boolean {
  if (item.text !== undefined) return false;

  return matchesFunctionCall(item, call, occurrence);
}

function matchesFunctionCall(
  item: AntigravityReplayItem,
  call: JsonObject,
  occurrence: number,
): boolean {
  const id = stringField(call, 'id');
  const name = stringField(call, 'name');
  const args = isJsonObject(call['args']) ? call['args'] : {};

  if (conflictingCallId(id, item.id)) return false;
  if (conflictingOccurrence(id, item.occurrence, occurrence)) return false;

  return sameCallShape(item, name, args);
}

function sameCallShape(item: AntigravityReplayItem, name: string, args: JsonObject): boolean {
  return name === item.name && canonicalJson(args) === canonicalJson(item.args);
}

function conflictingOccurrence(id: string, cached: number | undefined, current: number): boolean {
  return id === '' && cached !== current;
}

function functionCallKey(name: string, args: JsonObject): string {
  return `${name}\0${canonicalJson(args)}`;
}

export function functionCallObjectKey(call: JsonObject): string {
  const name = stringField(call, 'name');
  const args = isJsonObject(call['args']) ? call['args'] : {};

  return functionCallKey(name, args);
}

export function replayItemKey(item: AntigravityReplayItem): string {
  return item.text === undefined
    ? `call\0${functionCallKey(item.name, item.args)}`
    : textReplayKey(item.text, item.thought === true);
}

export function textReplayKey(text: string, thought: boolean): string {
  return `text\0${thought ? 'thought' : 'visible'}\0${text}`;
}

function conflictingCallId(current: string, cached: string): boolean {
  return current !== '' && cached !== '' && current !== cached;
}

export function itemPart(item: AntigravityReplayItem, first: boolean): JsonObject {
  return item.text === undefined ? callItemPart(item, first) : textItemPart(item);
}

function textItemPart(item: AntigravityReplayItem): JsonObject {
  return {
    text: item.text ?? '',
    ...(item.thought === true ? { thought: true } : {}),
    ...(item.signature === undefined ? {} : { thoughtSignature: item.signature }),
  };
}

function callItemPart(item: AntigravityReplayItem, first: boolean): JsonObject {
  return {
    functionCall: {
      ...(item.id === '' ? {} : { id: item.id }),
      name: item.name,
      args: item.args,
    },
    ...(item.signature === undefined && !first
      ? {}
      : { thoughtSignature: item.signature ?? 'skip_thought_signature_validator' }),
  };
}
