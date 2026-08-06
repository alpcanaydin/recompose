import type { JsonObject } from '../gateway-wire';

const completionLimits = new Map<string, number>([
  ['claude-haiku-4-5-20251001', 64_000],
  ['claude-sonnet-4-5-20250929', 64_000],
  ['claude-sonnet-4-6', 64_000],
  ['claude-opus-4-6', 128_000],
  ['claude-opus-4-7', 128_000],
  ['claude-opus-4-8', 128_000],
  ['claude-opus-5', 128_000],
  ['claude-sonnet-5', 128_000],
  ['claude-fable-5', 128_000],
  ['claude-opus-4-5-20251101', 64_000],
  ['claude-opus-4-1-20250805', 32_000],
  ['claude-opus-4-20250514', 32_000],
  ['claude-sonnet-4-20250514', 64_000],
  ['claude-3-7-sonnet-20250219', 8192],
  ['claude-3-5-haiku-20241022', 8192],
]);

export const claudeSubscriptionModels = [...completionLimits.keys()];

export function withClaudeMaxTokens(body: JsonObject): JsonObject {
  if (body['max_tokens'] !== undefined || typeof body['model'] !== 'string') {
    return body;
  }

  const limit = completionLimits.get(body['model']);

  return limit === undefined ? body : { ...body, max_tokens: limit };
}
