import type { Hono } from 'hono';

import type { ProviderObservation } from './provider/provider-observability';

import { providerObservability } from './provider/provider-observability';

function countFrom(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return 1;

  const count = Number(value);

  return Number.isInteger(count) && count > 0 ? count : null;
}

function usageRecord(record: ProviderObservation) {
  return {
    provider: record.provider,
    model: record.model,
    ...(record.accountId === undefined ? {} : { account_id: record.accountId }),
    started_at: record.startedAt,
    duration_ms: record.durationMs,
    ttft_ms: record.ttftMs,
    status: record.status,
    generate: record.generate,
    ...(record.requestIdHash === undefined ? {} : { request_id_hash: record.requestIdHash }),
    ...(record.upstreamRequestIdHash === undefined
      ? {}
      : { upstream_request_id_hash: record.upstreamRequestIdHash }),
    usage: {
      input_tokens: record.usage.inputTokens,
      output_tokens: record.usage.outputTokens,
      total_tokens: record.usage.totalTokens,
      cache_read_tokens: record.usage.cacheReadTokens,
      cache_write_tokens: record.usage.cacheWriteTokens,
      reasoning_tokens: record.usage.reasoningTokens,
    },
  };
}

export function registerManagementUsage(app: Hono): void {
  app.get('/v0/management/usage-queue', (c) => {
    const count = countFrom(c.req.query('count'));

    if (count === null) return c.json({ error: 'count must be a positive integer' }, 400);

    return c.json(providerObservability().popOldest(count).map(usageRecord));
  });
}
