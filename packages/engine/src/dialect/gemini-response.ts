import type { Fate, Translated } from './fates';
import type { GeminiPart, GeminiResponse, GeminiUsage } from './gemini-wire';
import type { HubContentBlock, HubResponse, HubStopReason, HubUsage } from './hub';

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

export function geminiUsage(usage: GeminiUsage): HubUsage {
  const hub: HubUsage = {};

  if (usage.promptTokenCount !== undefined) hub.inputTokens = usage.promptTokenCount;
  if (usage.candidatesTokenCount !== undefined) hub.outputTokens = usage.candidatesTokenCount;
  if (usage.cachedContentTokenCount !== undefined)
    hub.cacheReadTokens = usage.cachedContentTokenCount;
  if (usage.thoughtsTokenCount !== undefined) hub.reasoningTokens = usage.thoughtsTokenCount;

  return hub;
}

function functionBlock(part: GeminiPart, index: number): HubContentBlock | null {
  const call = part.functionCall;

  if (call === undefined) {
    return null;
  }

  return {
    type: 'tool_use',
    id: call.id ?? `call_${String(index)}`,
    name: call.name,
    input: call.args ?? {},
  };
}

function partFrom(part: GeminiPart, index: number, fates: Fate[]): HubContentBlock | null {
  const call = functionBlock(part, index);

  if (call !== null) {
    return call;
  }

  if (part.text === undefined) {
    fates.push({
      field: `candidates.0.content.parts.${String(index)}`,
      disposition: 'mapped',
      to: 'absent',
    });

    return null;
  }

  if (part.thought === true) {
    return {
      type: 'thinking',
      text: part.text,
      ...(part.thoughtSignature === undefined ? {} : { signature: part.thoughtSignature }),
    };
  }

  return { type: 'text', text: part.text };
}

function firstCandidate(response: GeminiResponse) {
  return response.candidates === undefined ? undefined : response.candidates[0];
}

function decodedParts(parts: GeminiPart[], fates: Fate[]): HubContentBlock[] {
  const content: HubContentBlock[] = [];

  for (const [index, part] of parts.entries()) {
    const decoded = partFrom(part, index, fates);

    if (decoded !== null) content.push(decoded);
  }

  return content;
}

function partsOf(response: GeminiResponse): GeminiPart[] {
  const candidate = firstCandidate(response);

  return candidate?.content?.parts ?? [];
}

function finishOf(response: GeminiResponse): string | undefined {
  return firstCandidate(response)?.finishReason;
}

export function decodeResponse(response: GeminiResponse): Translated<HubResponse> {
  const fates: Fate[] = [];
  const content = decodedParts(partsOf(response), fates);

  return {
    value: {
      content,
      stopReason: geminiStopReason(finishOf(response)),
      usage: geminiUsage(response.usageMetadata ?? {}),
    },
    fates,
  };
}
