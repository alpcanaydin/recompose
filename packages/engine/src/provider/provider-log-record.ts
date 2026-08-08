import type { ProviderObservation } from './provider-observability';

function requestIdFields(record: ProviderObservation) {
  return {
    ...(record.requestIdHash === undefined ? {} : { request_id_hash: record.requestIdHash }),
    ...(record.upstreamRequestIdHash === undefined
      ? {}
      : { upstream_request_id_hash: record.upstreamRequestIdHash }),
  };
}

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
    ...requestIdFields(record),
    ...(record.version === undefined ? {} : { version: record.version }),
    ...(record.media === undefined
      ? {}
      : {
          connection: record.media.connection,
          proxy_scheme: record.media.proxyScheme,
          remote_transport: record.media.remoteTransport,
          media_session_id: record.media.sessionId,
          call_id: record.media.callId,
          peer: record.media.peer,
          state: record.media.state,
        }),
  };

  return `[${timestamp}] ${JSON.stringify(payload)}\n`;
}
