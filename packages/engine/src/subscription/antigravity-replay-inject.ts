import type { JsonObject } from '../gateway-wire';
import type { AntigravityReplayItem } from './antigravity-replay-items';

import { isJsonObject } from '../gateway-wire';
import { itemPart, matchesCall, matchesResponse } from './antigravity-replay-items';
import { nativeGeminiSignature } from './antigravity-signature-envelope';

function responseOf(part: unknown): JsonObject | null {
  if (!isJsonObject(part)) return null;

  return isJsonObject(part['functionResponse']) ? part['functionResponse'] : null;
}

function responseItems(parts: unknown[], items: readonly AntigravityReplayItem[]) {
  const matched: AntigravityReplayItem[] = [];
  const seen = new Set<AntigravityReplayItem>();

  for (const part of parts) {
    const response = responseOf(part);

    if (response === null) continue;

    const item = items.find((candidate) => matchesResponse(candidate, response));

    if (item !== undefined && !seen.has(item)) {
      matched.push(item);
      seen.add(item);
    }
  }

  return matched;
}

function existingCallIds(contents: unknown[]): Set<string> {
  const ids = new Set<string>();

  for (const content of contents) {
    addContentCallIds(ids, content);
  }

  return ids;
}

function addContentCallIds(ids: Set<string>, content: unknown): void {
  if (!isJsonObject(content) || !Array.isArray(content['parts'])) return;

  const parts: unknown[] = content['parts'];

  for (const part of parts) addPartCallId(ids, part);
}

function addPartCallId(ids: Set<string>, part: unknown): void {
  if (!isJsonObject(part) || !isJsonObject(part['functionCall'])) return;

  const id = part['functionCall']['id'];

  if (typeof id === 'string' && id !== '') ids.add(id);
}

function missingItems(
  contents: unknown[],
  parts: unknown[],
  items: readonly AntigravityReplayItem[],
): AntigravityReplayItem[] {
  const ids = existingCallIds(contents);

  return responseItems(parts, items).filter((item) => item.id === '' || !ids.has(item.id));
}

function enrichedPart(part: unknown, items: readonly AntigravityReplayItem[]): unknown {
  if (!isJsonObject(part)) return part;
  if (nativeGeminiSignature(part['thoughtSignature']) !== null) return part;

  const call = part['functionCall'];

  if (!isJsonObject(call)) return part;

  const item = items.find((candidate) => matchesCall(candidate, call));

  return enrichedWithSignature(part, item?.signature);
}

function enrichedWithSignature(part: JsonObject, signature: string | undefined): JsonObject {
  return signature === undefined ? part : { ...part, thoughtSignature: signature };
}

function enrichedContent(content: unknown, items: readonly AntigravityReplayItem[]): unknown {
  if (!isJsonObject(content) || !Array.isArray(content['parts'])) return content;

  const parts: unknown[] = content['parts'];

  return { ...content, parts: parts.map((part) => enrichedPart(part, items)) };
}

function injectedContents(contents: unknown[], items: readonly AntigravityReplayItem[]): unknown[] {
  const result: unknown[] = [];

  for (const content of contents) {
    if (!isJsonObject(content) || !Array.isArray(content['parts'])) {
      result.push(content);
      continue;
    }

    const parts: unknown[] = content['parts'];
    const missing = missingItems(contents, parts, items);

    if (missing.length > 0) {
      result.push({
        role: 'model',
        parts: missing.map((item, index) => itemPart(item, index === 0)),
      });
    }

    result.push(enrichedContent(content, items));
  }

  return result;
}

export function injectAntigravityReplay(
  body: JsonObject,
  items: readonly AntigravityReplayItem[],
): JsonObject {
  const rawContents = body['contents'];

  if (!Array.isArray(rawContents) || items.length === 0) return body;

  const contents: unknown[] = rawContents;

  return { ...body, contents: injectedContents(contents, items) };
}
