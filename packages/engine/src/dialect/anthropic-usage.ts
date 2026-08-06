import type { AnthropicUsage } from './anthropic-wire';
import type { HubUsage } from './hub';

export function hubUsageFrom(usage: AnthropicUsage | undefined): HubUsage {
  if (usage === undefined) {
    return {};
  }

  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    ...(usage.cache_read_input_tokens === undefined
      ? {}
      : { cacheReadTokens: usage.cache_read_input_tokens }),
    ...(usage.cache_creation_input_tokens === undefined
      ? {}
      : { cacheWriteTokens: usage.cache_creation_input_tokens }),
  };
}

export function wireUsageFrom(usage: HubUsage): AnthropicUsage {
  return {
    input_tokens: usage.inputTokens ?? 0,
    output_tokens: usage.outputTokens ?? 0,
    ...(usage.cacheReadTokens === undefined
      ? {}
      : { cache_read_input_tokens: usage.cacheReadTokens }),
    ...(usage.cacheWriteTokens === undefined
      ? {}
      : { cache_creation_input_tokens: usage.cacheWriteTokens }),
  };
}
