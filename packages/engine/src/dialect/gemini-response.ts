import type { Fate, Translated } from './fates';
import type { GeminiPart, GeminiResponse, GeminiUsage } from './gemini-wire';
import type { HubContentBlock, HubResponse, HubStopReason, HubToolInput, HubUsage } from './hub';

import { isGeminiBypass, nativeGeminiSignature } from '../provider/gemini-signature';
import { geminiMediaBlock } from './gemini-media-decode';
import { geminiClaudeToolUseId } from './gemini-tool-provenance';

const stopReasons = new Map<string, HubStopReason>([
  ['STOP', 'end'],
  ['MAX_TOKENS', 'max_output'],
  ['SAFETY', 'refusal'],
  ['PROHIBITED_CONTENT', 'refusal'],
  ['RECITATION', 'refusal'],
  ['MALFORMED_FUNCTION_CALL', 'tool_use'],
  ['UNEXPECTED_TOOL_CALL', 'tool_use'],
]);

export function geminiStopReason(reason: string | undefined): HubStopReason {
  return reason === undefined ? 'end' : (stopReasons.get(reason) ?? 'end');
}

function geminiInputTokens(usage: GeminiUsage): number | undefined {
  const prompt = geminiPromptTokens(usage);

  return prompt === undefined ? undefined : Math.max(0, prompt - (geminiCachedTokens(usage) ?? 0));
}

function geminiPromptTokens(usage: GeminiUsage): number | undefined {
  return usage.promptTokenCount ?? usage.prompt_token_count;
}

function geminiOutputTokens(usage: GeminiUsage): number | undefined {
  return usage.candidatesTokenCount ?? usage.candidates_token_count;
}

function geminiCachedTokens(usage: GeminiUsage): number | undefined {
  return usage.cachedContentTokenCount ?? usage.cached_content_token_count;
}

function geminiReasoningTokens(usage: GeminiUsage): number | undefined {
  return usage.thoughtsTokenCount ?? usage.thoughts_token_count;
}

function applyUsage(hub: HubUsage, field: keyof HubUsage, value: number | undefined): void {
  if (value !== undefined) hub[field] = value;
}

export function geminiUsage(usage: GeminiUsage): HubUsage {
  const hub: HubUsage = {};

  applyUsage(hub, 'inputTokens', geminiInputTokens(usage));
  applyUsage(hub, 'totalInputTokens', geminiPromptTokens(usage));
  applyUsage(hub, 'outputTokens', geminiOutputTokens(usage));
  applyUsage(hub, 'cacheReadTokens', geminiCachedTokens(usage));
  applyUsage(hub, 'reasoningTokens', geminiReasoningTokens(usage));
  applyUsage(hub, 'webSearchRequests', usage.webSearchRequests);

  return hub;
}

function functionBlock(
  part: GeminiPart,
  index: number,
  claudeProvenance: boolean,
): HubContentBlock | null {
  const call = part.functionCall;

  if (call === undefined) {
    return null;
  }

  return {
    type: 'tool_use',
    id: toolUseId(
      geminiCallId(call, index),
      call.name,
      geminiCallInput(call.args),
      claudeProvenance,
    ),
    name: call.name,
    input: geminiCallInput(call.args),
    ...geminiCallSignature(part.thoughtSignature),
  };
}

export function geminiCallId(call: { id?: string; call_id?: string }, index: number): string {
  return call.id ?? call.call_id ?? `call_${String(index)}`;
}

function geminiCallInput(args: HubToolInput): HubToolInput {
  return args ?? {};
}

function geminiCallSignature(signature: string | undefined): { signature?: string } {
  return signature === undefined ? {} : { signature };
}

function toolUseId(id: string, name: string, args: unknown, provenance: boolean): string {
  const stable = provenance ? geminiClaudeToolUseId(id, name, args) : '';

  return stable === '' ? id : stable;
}

function partFrom(
  part: GeminiPart,
  index: number,
  fates: Fate[],
  claudeProvenance: boolean,
  preserveTextSignatures: boolean,
): HubContentBlock | null {
  const structured = structuredBlock(part, index, claudeProvenance);

  if (structured !== null) return structured;

  if (part.text === undefined) {
    fates.push({
      field: `candidates.0.content.parts.${String(index)}`,
      disposition: 'mapped',
      to: 'absent',
    });

    return null;
  }

  return part.thought === true
    ? thinkingBlock(part)
    : visibleTextBlock(part, preserveTextSignatures);
}

function thinkingBlock(part: GeminiPart): HubContentBlock {
  return {
    type: 'thinking',
    text: part.text ?? '',
    ...(part.thoughtSignature === undefined ? {} : { signature: part.thoughtSignature }),
    ...(part.responsesSignatureDirection === undefined
      ? {}
      : { carrierDirection: part.responsesSignatureDirection }),
    ...(part.responsesSignatureTarget === undefined
      ? {}
      : { carrierTarget: part.responsesSignatureTarget }),
  };
}

function visibleTextBlock(part: GeminiPart, preserveSignature: boolean): HubContentBlock {
  const signature = preserveSignature ? geminiTextSignature(part.thoughtSignature) : undefined;

  return {
    type: 'text',
    text: part.text ?? '',
    ...visibleTextMetadata(part, signature),
  };
}

function visibleTextMetadata(part: GeminiPart, signature: string | undefined) {
  return {
    ...(part.citations === undefined ? {} : { citations: part.citations }),
    ...(signature === undefined ? {} : { signature }),
    ...(part.responsesSignatureDirection === undefined
      ? {}
      : { signatureDirection: part.responsesSignatureDirection }),
  };
}

function geminiTextSignature(value: unknown): string | undefined {
  const signature = nativeGeminiSignature(value);

  return signature === null || isGeminiBypass(signature) ? undefined : signature;
}

function structuredBlock(
  part: GeminiPart,
  index: number,
  claudeProvenance: boolean,
): HubContentBlock | null {
  return (
    serverWebSearchBlock(part) ??
    functionBlock(part, index, claudeProvenance) ??
    geminiMediaBlock(part)
  );
}

function serverWebSearchBlock(part: GeminiPart): HubContentBlock | null {
  const server = part.serverWebSearch;

  if (server === undefined) return null;

  return {
    type: 'tool_use',
    id: server.id,
    name: 'web_search',
    input: server.input,
    signature: server.kind === 'use' ? 'server:web-search' : 'server:web-search-result',
  };
}

function firstCandidate(response: GeminiResponse) {
  return response.candidates === undefined ? undefined : response.candidates[0];
}

function decodedParts(
  parts: GeminiPart[],
  fates: Fate[],
  claudeProvenance: boolean,
  preserveTextSignatures: boolean,
): HubContentBlock[] {
  const content: HubContentBlock[] = [];

  for (const [index, part] of parts.entries()) {
    const decoded = partFrom(part, index, fates, claudeProvenance, preserveTextSignatures);

    if (decoded !== null) content.push(decoded);
  }

  return content;
}

function partsOf(response: GeminiResponse): GeminiPart[] {
  const candidate = firstCandidate(response);

  return candidate?.content?.parts ?? [];
}

export function geminiFinishReason(response: GeminiResponse): string | undefined {
  const candidate = firstCandidate(response);

  return candidate?.finishReason ?? candidate?.finish_reason;
}

export function geminiResponseUsage(response: GeminiResponse): GeminiUsage {
  return response.usageMetadata ?? response.usage_metadata ?? {};
}

export function geminiResponseId(response: GeminiResponse): string | undefined {
  return response.responseId ?? response.response_id;
}

export function geminiResponseModel(response: GeminiResponse): string | undefined {
  return response.modelVersion ?? response.model_version;
}

export function decodeResponse(
  response: GeminiResponse,
  claudeProvenance = false,
  preserveTextSignatures = false,
): Translated<HubResponse> {
  const fates: Fate[] = [];
  const content = decodedParts(partsOf(response), fates, claudeProvenance, preserveTextSignatures);
  const id = geminiResponseId(response);
  const model = geminiResponseModel(response);

  return {
    value: {
      ...(id === undefined ? {} : { id }),
      ...(model === undefined ? {} : { model }),
      content,
      stopReason: geminiStopReason(geminiFinishReason(response)),
      usage: geminiUsage(geminiResponseUsage(response)),
    },
    fates,
  };
}
