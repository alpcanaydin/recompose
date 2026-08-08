import type { ChatUsage } from './chat-completions-wire';
import type { HubUsage } from './hub';

import { sumDefinedTokens } from './usage-tokens';

function cachedTokensOf(usage: ChatUsage): number | undefined {
  return usage.prompt_tokens_details?.cached_tokens;
}

function cacheWriteTokensOf(usage: ChatUsage): number | undefined {
  return usage.prompt_tokens_details?.cached_creation_tokens;
}

function reasoningTokensOf(usage: ChatUsage): number | undefined {
  return usage.completion_tokens_details?.reasoning_tokens;
}

function optionalHubToken(field: keyof HubUsage, value: number | undefined): Partial<HubUsage> {
  return value === undefined ? {} : { [field]: value };
}

export function hubUsageFromChat(usage: ChatUsage | undefined): HubUsage {
  if (usage === undefined) {
    return {};
  }

  const cached = cachedTokensOf(usage);

  return {
    inputTokens: Math.max(0, usage.prompt_tokens - (cached ?? 0)),
    outputTokens: usage.completion_tokens,
    ...optionalHubToken('cacheReadTokens', cached),
    ...optionalHubToken('cacheWriteTokens', cacheWriteTokensOf(usage)),
    ...optionalHubToken('reasoningTokens', reasoningTokensOf(usage)),
  };
}

function cachedTokensDetail(usage: HubUsage): {
  prompt_tokens_details?: { cached_tokens?: number; cached_creation_tokens?: number };
} {
  return usage.cacheReadTokens === undefined && usage.cacheWriteTokens === undefined
    ? {}
    : {
        prompt_tokens_details: {
          ...(usage.cacheReadTokens === undefined ? {} : { cached_tokens: usage.cacheReadTokens }),
          ...(usage.cacheWriteTokens === undefined
            ? {}
            : { cached_creation_tokens: usage.cacheWriteTokens }),
        },
      };
}

function reasoningTokensDetail(reasoningTokens: number | undefined): {
  completion_tokens_details?: { reasoning_tokens: number };
} {
  return reasoningTokens === undefined
    ? {}
    : { completion_tokens_details: { reasoning_tokens: reasoningTokens } };
}

export function chatUsageFromHub(usage: HubUsage): ChatUsage {
  const promptTokens =
    usage.totalInputTokens ??
    sumDefinedTokens([usage.inputTokens, usage.cacheReadTokens, usage.cacheWriteTokens]) ??
    0;
  const completionTokens = usage.outputTokens ?? 0;

  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    ...cachedTokensDetail(usage),
    ...reasoningTokensDetail(usage.reasoningTokens),
  };
}

export function mergedStreamUsage(begin: HubUsage, end: HubUsage): HubUsage {
  return { ...begin, ...end };
}
