import { createHash } from 'node:crypto';

import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

export type ReplayTurn = {
  reasoning: JsonObject[];
  calls: JsonObject[];
  callIds: string[];
  requestFingerprint?: string;
  assistantText?: string;
};

function textParts(value: unknown): string {
  if (typeof value === 'string') return value;

  return Array.isArray(value)
    ? value
        .flatMap((part) =>
          isJsonObject(part) && typeof part['text'] === 'string' ? [part['text']] : [],
        )
        .join('')
    : '';
}

function assistantText(value: unknown): string | undefined {
  if (!isJsonObject(value) || value['type'] !== 'message' || value['role'] !== 'assistant') {
    return undefined;
  }

  const text = textParts(value['content']);

  return text === '' ? undefined : text;
}

function callId(value: unknown): string | undefined {
  if (
    !isJsonObject(value) ||
    !['function_call', 'custom_tool_call'].includes(String(value['type']))
  ) {
    return undefined;
  }

  return typeof value['call_id'] === 'string' && value['call_id'] !== ''
    ? value['call_id']
    : undefined;
}

function replayReasoningItem(value: unknown): JsonObject | undefined {
  if (!isJsonObject(value) || value['type'] !== 'reasoning') return undefined;

  const signature = value['encrypted_content'];

  if (typeof signature !== 'string' || signature === '') return undefined;

  return {
    type: 'reasoning',
    ...reasoningId(value['id']),
    summary: [],
    content: null,
    encrypted_content: signature,
  };
}

function reasoningId(value: unknown): JsonObject {
  return typeof value === 'string' ? { id: value } : {};
}

function replayReasoning(value: unknown): JsonObject[] {
  const item = replayReasoningItem(value);

  return item === undefined ? [] : [item];
}

function replayCalls(value: unknown): JsonObject[] {
  return callId(value) === undefined || !isJsonObject(value) ? [] : [structuredClone(value)];
}

function inputOf(body: JsonObject | undefined): unknown[] {
  const input = body?.['input'];

  return Array.isArray(input) ? input : [];
}

export function codexReplayPrefixFingerprint(items: readonly unknown[], end: number): string {
  if (end < 0 || end > items.length) return '';

  return createHash('sha256')
    .update(JSON.stringify(items.slice(0, end)))
    .digest('hex');
}

export function replayTurnFrom(output: unknown, requestBody?: JsonObject): ReplayTurn | undefined {
  if (!Array.isArray(output)) return undefined;

  const reasoning = output.flatMap(replayReasoning);
  const calls = output.flatMap(replayCalls);

  if (reasoning.length === 0 && calls.length === 0) return undefined;

  return {
    reasoning,
    calls,
    callIds: calls.flatMap(callIdsOf),
    ...turnContext(output, requestBody),
  };
}

function callIdsOf(item: JsonObject): string[] {
  const id = callId(item);

  return id === undefined ? [] : [id];
}

function turnContext(output: unknown[], requestBody: JsonObject | undefined): Partial<ReplayTurn> {
  const text = output.map(assistantText).find((candidate) => candidate !== undefined);
  const request = inputOf(requestBody);
  const requestFingerprint =
    request.length === 0 ? undefined : codexReplayPrefixFingerprint(request, request.length);

  return {
    ...(text === undefined ? {} : { assistantText: text }),
    ...(requestFingerprint === undefined ? {} : { requestFingerprint }),
  };
}
