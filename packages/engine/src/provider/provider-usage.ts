import type { ProviderDialect } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
};

export const emptyProviderUsage = (): ProviderUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
});

function numberAt(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function tokenAt(usage: Record<string, unknown>, primary: string, fallback: string): number {
  return numberAt(usage[primary] ?? usage[fallback]);
}

function objectAt(value: unknown, field: string): Record<string, unknown> | undefined {
  if (!isJsonObject(value)) return undefined;

  const nested = value[field];

  return isJsonObject(nested) ? nested : undefined;
}

function usageObject(body: unknown): Record<string, unknown> {
  const direct = objectAt(body, 'usage');
  const response = objectAt(body, 'response');
  const interaction = objectAt(body, 'interaction');
  const metadata = objectAt(body, 'metadata');

  return (
    direct ??
    objectAt(response, 'usage') ??
    objectAt(interaction, 'usage') ??
    objectAt(metadata, 'total_usage') ??
    {}
  );
}

function detailsAt(
  usage: Record<string, unknown>,
  primary: string,
  fallback: string,
): Record<string, unknown> {
  return objectAt(usage, primary) ?? objectAt(usage, fallback) ?? {};
}

function openAIUsage(body: unknown): ProviderUsage {
  const usage = usageObject(body);
  const input = numberAt(usage['prompt_tokens'] ?? usage['input_tokens']);
  const output = numberAt(usage['completion_tokens'] ?? usage['output_tokens']);
  const inputDetails = detailsAt(usage, 'input_tokens_details', 'prompt_tokens_details');
  const outputDetails = detailsAt(usage, 'output_tokens_details', 'completion_tokens_details');

  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: numberAt(usage['total_tokens']) || input + output,
    cacheReadTokens: numberAt(inputDetails['cached_tokens']),
    cacheWriteTokens: numberAt(
      inputDetails['cache_write_tokens'] ?? inputDetails['cache_creation_tokens'],
    ),
    reasoningTokens: numberAt(outputDetails['reasoning_tokens']),
  };
}

function anthropicUsage(body: unknown): ProviderUsage {
  const usage = usageObject(body);
  const input = numberAt(usage['input_tokens']);
  const output = numberAt(usage['output_tokens']);
  const cacheRead = numberAt(usage['cache_read_input_tokens']);
  const cacheWrite = numberAt(usage['cache_creation_input_tokens']);
  const outputDetails = objectAt(usage, 'output_tokens_details');
  const reasoning = numberAt(outputDetails?.['thinking_tokens'] ?? usage['thinking_tokens']);

  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output + cacheRead + cacheWrite,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    reasoningTokens: reasoning,
  };
}

function geminiUsage(body: unknown): ProviderUsage {
  const usage = objectAt(body, 'usageMetadata');

  if (usage === undefined) return emptyProviderUsage();

  const input = numberAt(usage['promptTokenCount']) + numberAt(usage['toolUsePromptTokenCount']);
  const output = numberAt(usage['candidatesTokenCount']);
  const reasoning = numberAt(usage['thoughtsTokenCount']);

  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: numberAt(usage['totalTokenCount']) || input + output + reasoning,
    cacheReadTokens: numberAt(usage['cachedContentTokenCount']),
    cacheWriteTokens: 0,
    reasoningTokens: reasoning,
  };
}

function interactionsUsage(body: unknown): ProviderUsage {
  const usage = usageObject(body);
  const toolUse = numberAt(usage['total_tool_use_tokens']);
  const input = tokenAt(usage, 'input_tokens', 'total_input_tokens') + toolUse;
  const output = tokenAt(usage, 'output_tokens', 'total_output_tokens');
  const reasoning = tokenAt(usage, 'reasoning_tokens', 'total_thought_tokens');

  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: numberAt(usage['total_tokens']) || input + output + reasoning,
    cacheReadTokens: tokenAt(usage, 'cached_tokens', 'total_cached_tokens'),
    cacheWriteTokens: tokenAt(usage, 'cache_write_tokens', 'cache_creation_input_tokens'),
    reasoningTokens: reasoning,
  };
}

function parsedUsage(dialect: ProviderDialect, value: unknown): ProviderUsage {
  if (dialect === 'gemini') return geminiUsage(value);
  if (dialect === 'anthropic') return anthropicUsage(value);
  if (dialect === 'interactions') return interactionsUsage(value);

  return openAIUsage(value);
}

function mergeUsage(current: ProviderUsage, next: ProviderUsage): ProviderUsage {
  return next.totalTokens === 0 ? current : next;
}

export function providerUsageFrom(dialect: ProviderDialect, text: string): ProviderUsage {
  const direct = parsedJson(text);

  if (direct !== undefined) return parsedUsage(dialect, direct);

  return text.split('\n').reduce((usage, line) => {
    if (!line.startsWith('data:')) return usage;

    return mergeUsage(usage, parsedUsage(dialect, parsedJson(line.slice(5).trim())));
  }, emptyProviderUsage());
}
