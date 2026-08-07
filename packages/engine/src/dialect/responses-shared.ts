import type { Fate } from './fates';
import type {
  HubContentBlock,
  HubImageBlock,
  HubRedactedThinkingBlock,
  HubStopReason,
  HubTextBlock,
  HubThinkingBlock,
  HubToolResultBlock,
  HubToolUseBlock,
  HubUsage,
} from './hub';
import type {
  ResponsesContentPart,
  ResponsesFunctionCallItem,
  ResponsesFunctionCallOutputItem,
  ResponsesIncompleteReason,
  ResponsesReasoningItem,
  ResponsesStatus,
  ResponsesUsage,
} from './responses-wire';

import { imageBlockFromDataUri, parseToolArguments } from './hub-build';
import { hubBlockFromResponsesPart } from './responses-media-decode';
import { sanitizeToolId } from './tool-id';

export const translatedResponseId = 'resp_translated';

export function toHubContentBlocks(
  content: string | readonly ResponsesContentPart[],
): HubContentBlock[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content.map(hubBlockFromResponsesPart);
}

export function toolUseBlockOf(
  item: ResponsesFunctionCallItem,
  signature?: string,
): HubToolUseBlock {
  return {
    type: 'tool_use',
    id: sanitizeToolId(item.call_id),
    name: item.name,
    input: parseToolArguments(item.arguments),
    ...(signature === undefined ? {} : { signature }),
  };
}

function toolResultContentOf(output: string): HubTextBlock | HubImageBlock {
  return imageBlockFromDataUri(output) ?? { type: 'text', text: output };
}

export function toolResultBlockOf(item: ResponsesFunctionCallOutputItem): HubToolResultBlock {
  return {
    type: 'tool_result',
    toolUseId: sanitizeToolId(item.call_id),
    content: [toolResultContentOf(item.output)],
  };
}

export const COMPATIBLE_SIGNATURE_PREFIX = 'anthropic:';
const REDACTED_CONTENT_PREFIX = 'redacted';

export type ReasoningSignature =
  | { kind: 'none' }
  | { kind: 'compatible'; signature: string }
  | { kind: 'redacted'; data: string }
  | { kind: 'foreign' };

function hasCodexSignatureShape(signature: string): boolean {
  const decoded = Buffer.from(signature, 'base64url');
  const ciphertextLength = decoded.length - 57;

  return decoded[0] === 0x80 && ciphertextLength > 0 && ciphertextLength % 16 === 0;
}

export function isCodexReasoningSignature(signature: string | undefined): signature is string {
  if (signature === undefined || !signature.startsWith('gAAAA')) {
    return false;
  }

  try {
    return hasCodexSignatureShape(signature);
  } catch {
    return false;
  }
}

export function classifyReasoningSignature(
  encryptedContent: string | undefined,
): ReasoningSignature {
  if (encryptedContent === undefined) {
    return { kind: 'none' };
  }

  if (encryptedContent.startsWith(REDACTED_CONTENT_PREFIX)) {
    return { kind: 'redacted', data: encryptedContent };
  }

  if (encryptedContent.startsWith(COMPATIBLE_SIGNATURE_PREFIX)) {
    return {
      kind: 'compatible',
      signature: encryptedContent.slice(COMPATIBLE_SIGNATURE_PREFIX.length),
    };
  }

  if (isCodexReasoningSignature(encryptedContent)) {
    return { kind: 'compatible', signature: encryptedContent };
  }

  return { kind: 'foreign' };
}

function summaryTextOf(item: ResponsesReasoningItem): string {
  return (item.summary ?? []).map((part) => part.text).join('\n');
}

export function thinkingBlockOf(item: ResponsesReasoningItem): HubThinkingBlock {
  return { type: 'thinking', text: summaryTextOf(item) };
}

export function signedThinkingBlockOf(
  item: ResponsesReasoningItem,
  signature: string,
): HubThinkingBlock {
  return { type: 'thinking', text: summaryTextOf(item), signature };
}

export function redactedThinkingBlockOf(data: string): HubRedactedThinkingBlock {
  return { type: 'redacted_thinking', data };
}

export function redactedThinkingDropFate(): Fate {
  return { field: 'redacted_thinking', disposition: 'mapped', to: 'absent', costBearing: true };
}

export function functionCallItemOf(block: HubToolUseBlock): ResponsesFunctionCallItem {
  return {
    type: 'function_call',
    call_id: block.id,
    name: block.name,
    arguments: JSON.stringify(block.input),
  };
}

export function thinkingDropFate(): Fate {
  return { field: 'thinking', disposition: 'mapped', to: 'absent', costBearing: true };
}

function cachedTokensOf(usage: ResponsesUsage): number | undefined {
  return usage.input_tokens_details?.cached_tokens;
}

function reasoningTokensOf(usage: ResponsesUsage): number | undefined {
  return usage.output_tokens_details?.reasoning_tokens;
}

function hubInputTokens(
  usage: ResponsesUsage,
  cached: number | undefined,
): { inputTokens?: number } {
  if (usage.input_tokens === undefined) {
    return {};
  }

  return { inputTokens: Math.max(0, usage.input_tokens - (cached ?? 0)) };
}

function hubUsageOf(usage: ResponsesUsage): HubUsage {
  const cached = cachedTokensOf(usage);
  const reasoning = reasoningTokensOf(usage);

  return {
    ...hubInputTokens(usage, cached),
    ...(usage.output_tokens === undefined ? {} : { outputTokens: usage.output_tokens }),
    ...(cached === undefined ? {} : { cacheReadTokens: cached }),
    ...(reasoning === undefined ? {} : { reasoningTokens: reasoning }),
  };
}

export function toHubUsage(usage: ResponsesUsage | undefined): HubUsage {
  return usage === undefined ? {} : hubUsageOf(usage);
}

function responsesInputTokens(usage: HubUsage): { input_tokens?: number } {
  if (usage.inputTokens === undefined) {
    return {};
  }

  return { input_tokens: usage.inputTokens + (usage.cacheReadTokens ?? 0) };
}

export function toResponsesUsage(usage: HubUsage): ResponsesUsage {
  return {
    ...responsesInputTokens(usage),
    ...(usage.outputTokens === undefined ? {} : { output_tokens: usage.outputTokens }),
    ...(usage.cacheReadTokens === undefined
      ? {}
      : { input_tokens_details: { cached_tokens: usage.cacheReadTokens } }),
    ...(usage.reasoningTokens === undefined
      ? {}
      : { output_tokens_details: { reasoning_tokens: usage.reasoningTokens } }),
  };
}

export type StopReasonOutcome = { stopReason: HubStopReason } | { unmappable: string };

function incompleteStopReason(reason: string | undefined): StopReasonOutcome {
  if (reason === 'max_output_tokens') {
    return { stopReason: 'max_output' };
  }

  if (reason === 'content_filter') {
    return { stopReason: 'refusal' };
  }

  return { unmappable: reason ?? 'incomplete' };
}

export function stopReasonFromResponse(
  status: ResponsesStatus,
  hasFunctionCall: boolean,
  incompleteReason: string | undefined,
): StopReasonOutcome {
  switch (status) {
    case 'completed':
      return { stopReason: hasFunctionCall ? 'tool_use' : 'end' };
    case 'incomplete':
      return incompleteStopReason(incompleteReason);
    case 'failed':
      return { unmappable: 'failed' };

    default: {
      const unhandled: never = status;

      throw new Error(`unhandled responses status: ${String(unhandled)}`);
    }
  }
}

export type StatusOutcome =
  | { status: ResponsesStatus; incompleteReason?: ResponsesIncompleteReason; lossy?: true }
  | { unmappable: string };

const statusByStopReason: Record<HubStopReason, StatusOutcome> = {
  end: { status: 'completed' },
  tool_use: { status: 'completed' },
  stop_sequence: { status: 'completed', lossy: true },
  max_output: { status: 'incomplete', incompleteReason: 'max_output_tokens' },
  refusal: { status: 'incomplete', incompleteReason: 'content_filter', lossy: true },
  paused: { unmappable: 'paused' },
  context_overflow: { unmappable: 'context_overflow' },
};

export function statusFromStopReason(stopReason: HubStopReason): StatusOutcome {
  return statusByStopReason[stopReason];
}
