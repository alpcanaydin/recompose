import type { JsonObject } from '../gateway-wire';
import type { AntigravityReplayItem } from './antigravity-replay-items';

import { isJsonObject } from '../gateway-wire';
import { nativeGeminiSignature } from './antigravity-signature-envelope';

export type TextReplayState = {
  buffer: string;
  thought: boolean;
  prefix?: string;
};

export type TextReplayScan = {
  state: TextReplayState;
  items: AntigravityReplayItem[];
};

function signatureOf(part: JsonObject): string | undefined {
  const camel = nativeGeminiSignature(part['thoughtSignature']);

  if (camel !== null) return camel;

  const snake = nativeGeminiSignature(part['thought_signature']);

  return snake ?? undefined;
}

function textItem(state: TextReplayState, signature: string): AntigravityReplayItem {
  return {
    id: '',
    name: '',
    args: {},
    text: state.buffer,
    thought: state.thought,
    signature,
  };
}

function resetState(): TextReplayState {
  return { buffer: '', thought: false };
}

function signedText(
  state: TextReplayState,
  signature: string,
  items: AntigravityReplayItem[],
): TextReplayState {
  if (state.buffer === '') return { ...state, prefix: signature };

  items.push(textItem(state, signature));

  return resetState();
}

function scanTextPart(
  value: unknown,
  state: TextReplayState,
  items: AntigravityReplayItem[],
): TextReplayState {
  if (!isTextPart(value)) return state;

  const text = typeof value['text'] === 'string' ? value['text'] : '';
  const signature = signatureOf(value);

  return scanTextValue(value, text, signature, state, items);
}

function isTextPart(value: unknown): value is JsonObject {
  return isJsonObject(value) && !isJsonObject(value['functionCall']);
}

function scanTextValue(
  part: JsonObject,
  text: string,
  signature: string | undefined,
  state: TextReplayState,
  items: AntigravityReplayItem[],
): TextReplayState {
  if (text === '') return signature === undefined ? state : signedText(state, signature, items);

  const next = {
    ...state,
    buffer: state.buffer + text,
    thought: state.thought || part['thought'] === true,
  };

  return signature === undefined ? next : signedText(next, signature, items);
}

export function scanTextReplayParts(parts: unknown[], initial: TextReplayState): TextReplayScan {
  const items: AntigravityReplayItem[] = [];
  let state = initial;

  for (const part of parts) state = scanTextPart(part, state, items);

  return { state, items };
}

export function finalizeTextReplay(scan: TextReplayScan): TextReplayScan {
  const signature = scan.state.prefix;

  if (signature === undefined || scan.state.buffer === '') return scan;

  return { state: resetState(), items: [...scan.items, textItem(scan.state, signature)] };
}
