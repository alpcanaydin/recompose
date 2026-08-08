import type { Translated } from './fates';
import type { GeminiPart, GeminiResponse, GeminiUsage } from './gemini-wire';
import type { HubContentBlock, HubResponse, HubStopReason, HubUsage } from './hub';

import { geminiMediaPart } from './gemini-media';
import { sumDefinedTokens } from './usage-tokens';

function textPart(block: HubContentBlock): GeminiPart | null {
  return block.type === 'text' ? { text: block.text } : null;
}

function thinkingPart(block: HubContentBlock): GeminiPart | null {
  return block.type !== 'thinking'
    ? null
    : {
        text: block.text,
        thought: true,
        ...(block.signature === undefined ? {} : { thoughtSignature: block.signature }),
      };
}

function toolPart(block: HubContentBlock): GeminiPart | null {
  return block.type !== 'tool_use'
    ? null
    : {
        functionCall: { id: block.id, name: block.name, args: block.input ?? {} },
        ...(block.signature === undefined ? {} : { thoughtSignature: block.signature }),
      };
}

function resultRecord(value: unknown): Record<string, unknown> {
  return typeof value !== 'object' || value === null || Array.isArray(value)
    ? { output: value }
    : Object.fromEntries(Object.entries(value));
}

function resultPart(block: HubContentBlock): GeminiPart | null {
  if (block.type !== 'tool_result') return null;

  const result =
    block.structuredResult !== undefined ? block.structuredResult : { output: block.content };

  return {
    functionResponse: {
      id: block.toolUseId,
      name: block.name ?? block.toolUseId,
      response: resultRecord(result),
    },
  };
}

function partOf(block: HubContentBlock): GeminiPart | null {
  return (
    textPart(block) ??
    thinkingPart(block) ??
    toolPart(block) ??
    resultPart(block) ??
    geminiMediaPart(block)
  );
}

function finishReason(reason: HubStopReason): string {
  if (reason === 'max_output' || reason === 'context_overflow') return 'MAX_TOKENS';
  if (reason === 'refusal') return 'SAFETY';

  return 'STOP';
}

export function geminiUsageFromHub(usage: HubUsage): GeminiUsage {
  const prompt =
    usage.totalInputTokens ??
    sumDefinedTokens([usage.inputTokens, usage.cacheReadTokens, usage.cacheWriteTokens]);
  const total = sumDefinedTokens([prompt, usage.outputTokens, usage.reasoningTokens]);

  const result: GeminiUsage = {};

  applyUsage(result, 'promptTokenCount', prompt);
  applyUsage(result, 'candidatesTokenCount', usage.outputTokens);
  applyUsage(result, 'cachedContentTokenCount', usage.cacheReadTokens);
  applyUsage(result, 'thoughtsTokenCount', usage.reasoningTokens);
  applyUsage(result, 'totalTokenCount', total);

  return result;
}

function applyUsage(
  result: GeminiUsage,
  field: keyof GeminiUsage,
  value: number | undefined,
): void {
  if (value !== undefined) result[field] = value;
}

export function encodeResponse(response: HubResponse): Translated<GeminiResponse> {
  const parts = response.content.flatMap((block) => {
    const part = partOf(block);

    return part === null ? [] : [part];
  });

  return {
    value: {
      ...(response.id === undefined ? {} : { responseId: response.id }),
      ...(response.model === undefined ? {} : { modelVersion: response.model }),
      candidates: [
        { content: { role: 'model', parts }, finishReason: finishReason(response.stopReason) },
      ],
      usageMetadata: geminiUsageFromHub(response.usage),
    },
    fates: [],
  };
}
