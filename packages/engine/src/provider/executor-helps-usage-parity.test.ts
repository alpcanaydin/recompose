import { expect, test } from 'vitest';

import { providerUsageFrom } from './provider-observability';

test('TestParseCodexUsageIncludesCacheWriteTokens', () => {
  const usage = providerUsageFrom(
    'responses',
    JSON.stringify({
      response: {
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          total_tokens: 120,
          input_tokens_details: { cached_tokens: 30, cache_write_tokens: 40 },
        },
      },
    }),
  );

  expect(usage).toMatchObject({
    inputTokens: 100,
    outputTokens: 20,
    totalTokens: 120,
    cacheReadTokens: 30,
    cacheWriteTokens: 40,
  });
});

test('TestParseOpenAIUsageNormalizesCacheCreationAlias', () => {
  const usage = providerUsageFrom(
    'responses',
    JSON.stringify({
      usage: {
        input_tokens: 3,
        input_tokens_details: { cache_creation_tokens: 2 },
      },
    }),
  );

  expect(usage.cacheWriteTokens).toBe(2);
});

test('TestParseInteractionsUsage', () => {
  const usage = providerUsageFrom(
    'interactions',
    JSON.stringify({
      usage: { input_tokens: 3, output_tokens: 4, reasoning_tokens: 5, cached_tokens: 2 },
    }),
  );

  expect(usage).toEqual({
    inputTokens: 3,
    outputTokens: 4,
    totalTokens: 12,
    cacheReadTokens: 2,
    cacheWriteTokens: 0,
    reasoningTokens: 5,
  });
});

test('TestParseInteractionsUsageNormalizesCacheWriteAlias', () => {
  const usage = providerUsageFrom(
    'interactions',
    JSON.stringify({ usage: { input_tokens: 3, cache_write_tokens: 2 } }),
  );

  expect(usage.cacheWriteTokens).toBe(2);
});

test('TestParseInteractionsUsageIncludesToolUseTokens', () => {
  const usage = providerUsageFrom(
    'interactions',
    JSON.stringify({
      usage: {
        total_input_tokens: 2,
        total_output_tokens: 6,
        total_thought_tokens: 3,
        total_tool_use_tokens: 4,
        total_tokens: 15,
      },
    }),
  );

  expect(usage).toMatchObject({
    inputTokens: 6,
    outputTokens: 6,
    reasoningTokens: 3,
    totalTokens: 15,
  });
});

test('TestParseInteractionsStreamUsageOfficialMetadata', () => {
  const usage = providerUsageFrom(
    'interactions',
    'data: {"event_type":"finish","metadata":{"total_usage":{"total_input_tokens":2,"total_output_tokens":6,"total_thought_tokens":3,"total_cached_tokens":1,"total_tokens":11}}}',
  );

  expect(usage).toEqual({
    inputTokens: 2,
    outputTokens: 6,
    totalTokens: 11,
    cacheReadTokens: 1,
    cacheWriteTokens: 0,
    reasoningTokens: 3,
  });
});
