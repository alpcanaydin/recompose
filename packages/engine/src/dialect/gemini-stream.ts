import type { GeminiPart, GeminiResponse } from './gemini-wire';
import type { HubBlockDelta, HubBlockOpening, HubContentBlock, HubStreamEvent } from './hub';

import { isGeminiBypass, nativeGeminiSignature } from '../provider/gemini-signature';
import { geminiMediaBlock } from './gemini-media-decode';
import {
  geminiCallId,
  geminiFinishReason,
  geminiResponseId,
  geminiResponseModel,
  geminiResponseUsage,
  geminiStopReason,
  geminiUsage,
} from './gemini-response';
import { geminiThinkingOpening } from './gemini-thinking-opening';
import { geminiClaudeToolUseId } from './gemini-tool-provenance';
import {
  geminiCitationDeltas,
  geminiWebSearchDeltas,
  geminiWebSearchOpening,
} from './gemini-web-search-stream-parts';

function openingOf(
  part: GeminiPart,
  index: number,
  claudeProvenance: boolean,
  preserveTextSignatures: boolean,
): HubBlockOpening | null {
  const server = geminiWebSearchOpening(part);

  if (server !== null) return server;

  const call = callOpening(part, index, claudeProvenance);

  if (call !== null) return call;

  if (part.text === undefined) {
    return null;
  }

  return part.thought === true
    ? geminiThinkingOpening(part)
    : textOpening(part, preserveTextSignatures);
}

function textOpening(part: GeminiPart, preserveSignature: boolean): HubBlockOpening {
  const signature = preserveSignature ? carriedToolSignature(part.thoughtSignature) : undefined;

  return {
    kind: 'text',
    ...(signature === undefined ? {} : { signature }),
    ...(part.responsesSignatureDirection === undefined
      ? {}
      : { signatureDirection: part.responsesSignatureDirection }),
  };
}

function callOpening(
  part: GeminiPart,
  index: number,
  claudeProvenance: boolean,
): HubBlockOpening | null {
  const call = part.functionCall;

  if (call === undefined) return null;

  const nativeId = geminiCallId(call, index);
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

  return [...geminiCitationDeltas(part), text, ...signature];
}

function deltasOf(part: GeminiPart): HubBlockDelta[] {
  return geminiWebSearchDeltas(part) ?? callDeltas(part) ?? textDeltas(part);
}

function* blockEvents(
  part: GeminiPart,
  index: number,
  claudeProvenance: boolean,
  preserveTextSignatures: boolean,
): Iterable<HubStreamEvent> {
  const media = geminiMediaBlock(part);

  if (isStreamMedia(media)) {
    yield { type: 'media', block: media };

    return;
  }

  const opening = openingOf(part, index, claudeProvenance, preserveTextSignatures);

  if (opening === null) {
    return;
  }

  yield { type: 'block-open', index, opening };

  for (const delta of deltasOf(part)) {
    yield { type: 'block-delta', index, delta };
  }

  yield { type: 'block-close', index };
}

function isStreamMedia(
  block: HubContentBlock | null,
): block is Extract<HubContentBlock, { type: 'image' | 'audio' | 'video' | 'document' }> {
  return (
    block !== null &&
    (block.type === 'image' ||
      block.type === 'audio' ||
      block.type === 'video' ||
      block.type === 'document')
  );
}

function partsIn(response: GeminiResponse): GeminiPart[] {
  return response.candidates?.[0]?.content?.parts ?? [];
}

function* beginning(began: boolean, response: GeminiResponse): Iterable<HubStreamEvent> {
  if (!began) {
    const id = geminiResponseId(response);
    const model = geminiResponseModel(response);

    yield {
      type: 'message-begin',
      usage: geminiUsage(geminiResponseUsage(response)),
      ...(id === undefined ? {} : { id }),
      ...(model === undefined ? {} : { model }),
    };
  }
}

function chunkEvents(
  response: GeminiResponse,
  firstIndex: number,
  claudeProvenance: boolean,
  toolSeen: boolean,
  preserveTextSignatures: boolean,
) {
  const folded = foldedParts(
    response,
    firstIndex,
    claudeProvenance,
    toolSeen,
    preserveTextSignatures,
  );
  const events = folded.events;

  const finish = geminiFinishReason(response);

  if (finish !== undefined) {
    events.push({
      type: 'message-end',
      stopReason: folded.sawTool ? 'tool_use' : geminiStopReason(finish),
      usage: geminiUsage(geminiResponseUsage(response)),
      ...(finish === 'STOP' ? { nativeStopReason: 'stop' } : {}),
    });
  }

  return { events, nextIndex: folded.nextIndex, sawTool: folded.sawTool };
}

function foldedParts(
  response: GeminiResponse,
  firstIndex: number,
  claudeProvenance: boolean,
  toolSeen: boolean,
  preserveTextSignatures: boolean,
) {
  const events: HubStreamEvent[] = [];
  let nextIndex = firstIndex;
  let sawTool = toolSeen;

  for (const part of partsIn(response)) {
    events.push(...blockEvents(part, nextIndex, claudeProvenance, preserveTextSignatures));
    if (part.functionCall !== undefined) sawTool = true;
    nextIndex += 1;
  }

  return { events, nextIndex, sawTool };
}

export async function* decodeStream(
  source: AsyncIterable<GeminiResponse>,
  claudeProvenance = false,
  preserveTextSignatures = false,
): AsyncIterable<HubStreamEvent> {
  const lifecycle: StreamLifecycle = {
    began: false,
    ended: false,
    index: 0,
    sawTool: false,
    usage: {},
  };

  for await (const response of source) {
    yield* decodedChunk(lifecycle, response, claudeProvenance, preserveTextSignatures);
  }

  yield* unfinishedTerminal(lifecycle);
}

function* unfinishedTerminal(lifecycle: StreamLifecycle): Iterable<HubStreamEvent> {
  if (!lifecycle.began || lifecycle.ended) return;

  yield { type: 'message-end', stopReason: 'end', usage: lifecycle.usage };
}

type StreamLifecycle = {
  began: boolean;
  ended: boolean;
  index: number;
  sawTool: boolean;
  usage: ReturnType<typeof geminiUsage>;
};

function decodedChunk(
  lifecycle: StreamLifecycle,
  response: GeminiResponse,
  claudeProvenance: boolean,
  preserveTextSignatures: boolean,
): HubStreamEvent[] {
  if (lifecycle.ended) return [];

  lifecycle.usage = {
    ...lifecycle.usage,
    ...geminiUsage(geminiResponseUsage(response)),
  };
  const events = [...beginning(lifecycle.began, response)];
  const chunk = chunkEvents(
    response,
    lifecycle.index,
    claudeProvenance,
    lifecycle.sawTool,
    preserveTextSignatures,
  );

  events.push(...chunk.events);
  lifecycle.began = true;
  lifecycle.index = chunk.nextIndex;
  lifecycle.sawTool = chunk.sawTool;
  lifecycle.ended = chunk.events.some((event) => event.type === 'message-end');

  return events;
}
