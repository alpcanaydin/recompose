import type { ProviderObservation } from './provider-observability';

export function providerLogLine(record: ProviderObservation, now = new Date()): string {
  const timestamp = now.toISOString().slice(0, 19).replace('T', ' ');
  const payload = {
    provider: record.provider,
    model: record.model,
    account_id: record.accountId,
    status: record.status,
    duration_ms: record.durationMs,
    ttft_ms: record.ttftMs,
    usage: record.usage,
  };

  return `[${timestamp}] ${JSON.stringify(payload)}\n`;
}
