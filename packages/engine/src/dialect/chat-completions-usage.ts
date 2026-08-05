import type { ChatUsage } from './chat-completions-wire';
import type { HubUsage } from './hub';

export function hubUsageFromChat(usage: ChatUsage | undefined): HubUsage {
  if (usage === undefined) {
    return {};
  }

  const cached = usage.prompt_tokens_details?.cached_tokens;

  return {
    inputTokens: usage.prompt_tokens - (cached ?? 0),
    outputTokens: usage.completion_tokens,
    ...(cached === undefined ? {} : { cacheReadTokens: cached }),
  };
}

function cachedTokensDetail(cacheReadTokens: number | undefined): {
  prompt_tokens_details?: { cached_tokens: number };
} {
  return cacheReadTokens === undefined
    ? {}
    : { prompt_tokens_details: { cached_tokens: cacheReadTokens } };
}

export function chatUsageFromHub(usage: HubUsage): ChatUsage {
  const cacheRead = usage.cacheReadTokens ?? 0;
  const promptTokens = (usage.inputTokens ?? 0) + cacheRead + (usage.cacheWriteTokens ?? 0);

  return {
    prompt_tokens: promptTokens,
    completion_tokens: usage.outputTokens ?? 0,
    ...cachedTokensDetail(usage.cacheReadTokens),
  };
}

export function mergedStreamUsage(begin: HubUsage, end: HubUsage): HubUsage {
  return { ...begin, ...end };
}
