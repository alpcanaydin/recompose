import type { GeminiPart, GeminiResponse } from './gemini-wire';
import type { HubBlockDelta, HubBlockOpening, HubStreamEvent } from './hub';

import { isGeminiBypass, nativeGeminiSignature } from '../provider/gemini-signature';
import { geminiStopReason, geminiUsage } from './gemini-response';
import { geminiClaudeToolUseId } from './gemini-tool-provenance';

function openingOf(
  part: GeminiPart,
  index: number,
  claudeProvenance: boolean,
): HubBlockOpening | null {
  const call = callOpening(part, index, claudeProvenance);

  if (call !== null) return call;

  if (part.text === undefined) {
    return null;
  }

  return { kind: part.thought === true ? 'thinking' : 'text' };
}

function callOpening(
  part: GeminiPart,
  index: number,
  claudeProvenance: boolean,
): HubBlockOpening | null {
  const call = part.functionCall;

  if (call === undefined) return null;

  const nativeId = nativeCallId(call.id, index);
  const signature = carriedToolSignature(part.thoughtSignature);

  return {
    kind: 'tool',
    id: provenanceId(nativeId, call.name, call.args, claudeProvenance),
    name: call.name,
    ...(signature === undefined ? {} : { signature }),
  };
}

function carriedToolSignature(value: unknown): string | undefined {
  const signature = nativeGeminiSignature(value);

  return signature === null || isGeminiBypass(signature) ? undefined : signature;
}

function nativeCallId(id: string | undefined, index: number): string {
  return id ?? `call_${String(index)}`;
}

function provenanceId(id: string, name: string, args: unknown, enabled: boolean): string {
  if (!enabled) return id;

  const stable = geminiClaudeToolUseId(id, name, args === undefined ? {} : args);

  return stable === '' ? id : stable;
}

function callDeltas(part: GeminiPart): HubBlockDelta[] | null {
  if (part.functionCall !== undefined) {
    return [{ kind: 'json-args', partialJson: JSON.stringify(part.functionCall.args ?? {}) }];
  }

  return null;
}

function textDeltas(part: GeminiPart): HubBlockDelta[] {
  if (part.text === undefined) {
    return [];
  }

  const text: HubBlockDelta =
    part.thought === true
      ? { kind: 'thinking', text: part.text }
      : { kind: 'text', text: part.text };
  const signature: HubBlockDelta[] =
    part.thoughtSignature === undefined
      ? []
      : [{ kind: 'signature', signature: part.thoughtSignature }];

  return [text, ...signature];
}

function deltasOf(part: GeminiPart): HubBlockDelta[] {
  return callDeltas(part) ?? textDeltas(part);
}

function* blockEvents(
  part: GeminiPart,
  index: number,
  claudeProvenance: boolean,
): Iterable<HubStreamEvent> {
  const opening = openingOf(part, index, claudeProvenance);

  if (opening === null) {
    return;
  }

  yield { type: 'block-open', index, opening };

  for (const delta of deltasOf(part)) {
    yield { type: 'block-delta', index, delta };
  }

  yield { type: 'block-close', index };
}

function finishReason(response: GeminiResponse) {
  return response.candidates?.[0]?.finishReason;
}

function partsIn(response: GeminiResponse): GeminiPart[] {
  return response.candidates?.[0]?.content?.parts ?? [];
}

function* beginning(began: boolean, response: GeminiResponse): Iterable<HubStreamEvent> {
  if (!began) {
    yield { type: 'message-begin', usage: geminiUsage(response.usageMetadata ?? {}) };
  }
}

function chunkEvents(response: GeminiResponse, firstIndex: number, claudeProvenance: boolean) {
  const events: HubStreamEvent[] = [];
  let index = firstIndex;

  for (const part of partsIn(response)) {
    events.push(...blockEvents(part, index, claudeProvenance));
    index += 1;
  }

  if (finishReason(response) !== undefined) {
    events.push({
      type: 'message-end',
      stopReason: geminiStopReason(finishReason(response)),
      usage: geminiUsage(response.usageMetadata ?? {}),
    });
  }

  return { events, nextIndex: index };
}

export async function* decodeStream(
  source: AsyncIterable<GeminiResponse>,
  claudeProvenance = false,
): AsyncIterable<HubStreamEvent> {
  let began = false;
  let index = 0;

  for await (const response of source) {
    yield* beginning(began, response);
    began = true;

    const chunk = chunkEvents(response, index, claudeProvenance);

    yield* chunk.events;
    index = chunk.nextIndex;
  }
}
