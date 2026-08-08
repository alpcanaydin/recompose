import type { AnthropicUsage } from './anthropic-wire';
import type { HubUsage } from './hub';

function hubTokenCounts(usage: Partial<AnthropicUsage>): HubUsage {
  return {
    ...(usage.input_tokens === undefined ? {} : { inputTokens: usage.input_tokens }),
    ...(usage.output_tokens === undefined ? {} : { outputTokens: usage.output_tokens }),
    ...(usage.thinking_tokens === undefined ? {} : { reasoningTokens: usage.thinking_tokens }),
  };
}

function hubCacheCounts(usage: Partial<AnthropicUsage>): HubUsage {
  return {
    ...(usage.cache_read_input_tokens === undefined
      ? {}
      : { cacheReadTokens: usage.cache_read_input_tokens }),
    ...(usage.cache_creation_input_tokens === undefined
      ? {}
      : { cacheWriteTokens: usage.cache_creation_input_tokens }),
  };
}

export function hubUsageFrom(usage: Partial<AnthropicUsage> | undefined): HubUsage {
  return usage === undefined ? {} : { ...hubTokenCounts(usage), ...hubCacheCounts(usage) };
}

function wireCacheCounts(usage: HubUsage): Partial<AnthropicUsage> {
  return {
    ...(usage.cacheReadTokens === undefined
      ? {}
      : { cache_read_input_tokens: usage.cacheReadTokens }),
    ...(usage.cacheWriteTokens === undefined
      ? {}
      : { cache_creation_input_tokens: usage.cacheWriteTokens }),
  };
}

function wireReasoningCount(usage: HubUsage): Partial<AnthropicUsage> {
  return usage.reasoningTokens === undefined ? {} : { thinking_tokens: usage.reasoningTokens };
}

function wireServerUsage(usage: HubUsage): Partial<AnthropicUsage> {
  return usage.webSearchRequests === undefined
    ? {}
    : { server_tool_use: { web_search_requests: usage.webSearchRequests } };
}

export function wireUsageFrom(usage: HubUsage): AnthropicUsage {
  return {
    input_tokens: usage.inputTokens ?? 0,
    output_tokens: usage.outputTokens ?? 0,
    ...wireCacheCounts(usage),
    ...wireReasoningCount(usage),
    ...wireServerUsage(usage),
  };
}
