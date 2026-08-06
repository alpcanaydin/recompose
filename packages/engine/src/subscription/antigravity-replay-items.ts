import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { nativeGeminiSignature } from './antigravity-signature-envelope';
import { canonicalJson } from './canonical-json';

export type AntigravityReplayItem = {
  id: string;
  name: string;
  args: JsonObject;
  signature?: string;
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

  scan.items.push(item);
  delete scan.prefix;
}

function captureDetached(scan: MutableReplayScan, signature: string | undefined): void {
  if (signature === undefined) return;

  if (attachDetachedSignature(scan.items, signature)) delete scan.prefix;
  else scan.prefix = signature;
}

function sameIdentity(left: AntigravityReplayItem, right: AntigravityReplayItem): boolean {
  if (left.id !== '' && right.id !== '') return left.id === right.id;

  return left.name === right.name && canonicalJson(left.args) === canonicalJson(right.args);
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
  const id = stringField(response, 'id');
  const name = stringField(response, 'name');

  if (id !== '' && item.id !== '') return id === item.id;

  return name !== '' && name !== 'unknown' && item.name === name;
}

export function matchesCall(item: AntigravityReplayItem, call: JsonObject): boolean {
  const id = stringField(call, 'id');
  const name = stringField(call, 'name');
  const args = isJsonObject(call['args']) ? call['args'] : {};

  if (conflictingCallId(id, item.id)) return false;

  return name === item.name && canonicalJson(args) === canonicalJson(item.args);
}

function conflictingCallId(current: string, cached: string): boolean {
  return current !== '' && cached !== '' && current !== cached;
}

export function itemPart(item: AntigravityReplayItem, first: boolean): JsonObject {
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
