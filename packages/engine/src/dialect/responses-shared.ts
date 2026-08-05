import type { Fate } from './fates';
import type {
  HubContentBlock,
  HubImageBlock,
  HubImageSource,
  HubJsonObject,
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

function isJsonObject(value: unknown): value is HubJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseArguments(raw: string): HubJsonObject {
  const parsed: unknown = JSON.parse(raw);

  return isJsonObject(parsed) ? parsed : {};
}

function imageSourceOf(imageUrl: string): HubImageSource {
  return { type: 'url', url: imageUrl };
}

function toHubContentBlock(part: ResponsesContentPart): HubTextBlock | HubImageBlock {
  switch (part.type) {
    case 'input_text':
    case 'output_text':
      return { type: 'text', text: part.text };
    case 'input_image':
      return { type: 'image', source: imageSourceOf(part.image_url) };

    default: {
      const unhandled: never = part;

      throw new Error(`unhandled responses content part: ${String(unhandled)}`);
    }
  }
}

export function toHubContentBlocks(
  content: string | readonly ResponsesContentPart[],
): HubContentBlock[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content.map(toHubContentBlock);
}

export function toolUseBlockOf(item: ResponsesFunctionCallItem): HubToolUseBlock {
  return {
    type: 'tool_use',
    id: item.call_id,
    name: item.name,
    input: parseArguments(item.arguments),
  };
}

export function toolResultBlockOf(item: ResponsesFunctionCallOutputItem): HubToolResultBlock {
  return {
    type: 'tool_result',
    toolUseId: item.call_id,
    content: [{ type: 'text', text: item.output }],
  };
}

export function thinkingBlockOf(item: ResponsesReasoningItem): HubThinkingBlock {
  return {
    type: 'thinking',
    text: (item.summary ?? []).map((part) => part.text).join('\n'),
  };
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

function hubUsageOf(usage: ResponsesUsage): HubUsage {
  const cached = cachedTokensOf(usage);
  const reasoning = reasoningTokensOf(usage);

  return {
    ...(usage.input_tokens === undefined ? {} : { inputTokens: usage.input_tokens }),
    ...(usage.output_tokens === undefined ? {} : { outputTokens: usage.output_tokens }),
    ...(cached === undefined ? {} : { cacheReadTokens: cached }),
    ...(reasoning === undefined ? {} : { reasoningTokens: reasoning }),
  };
}

export function toHubUsage(usage: ResponsesUsage | undefined): HubUsage {
  return usage === undefined ? {} : hubUsageOf(usage);
}

export function toResponsesUsage(usage: HubUsage): ResponsesUsage {
  return {
    ...(usage.inputTokens === undefined ? {} : { input_tokens: usage.inputTokens }),
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
  stop_sequence: { status: 'completed' },
  max_output: { status: 'incomplete', incompleteReason: 'max_output_tokens' },
  refusal: { status: 'incomplete', incompleteReason: 'content_filter', lossy: true },
  paused: { unmappable: 'paused' },
  context_overflow: { unmappable: 'context_overflow' },
};

export function statusFromStopReason(stopReason: HubStopReason): StatusOutcome {
  return statusByStopReason[stopReason];
}
