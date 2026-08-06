import { isJsonObject } from '../gateway-wire';

export type ProviderRequest = {
  url: string;
  headers: [string, string][];
  body: string;
};

type JsonObject = Record<string, unknown>;

type ClaudeRequestIds = {
  sessionId: string;
  requestId: string;
};

function claudeBetas(body: JsonObject): string {
  const betas = ['claude-code-20250219', 'oauth-2025-04-20'];

  appendThinkingBetas(betas, body);
  appendFeatureBetas(betas, body);

  return betas.join(',');
}

function appendThinkingBetas(betas: string[], body: JsonObject): void {
  if (hasOneMillionContext(body)) {
    betas.push('context-1m-2025-08-07');
  }

  betas.push('interleaved-thinking-2025-05-14');

  if (!hasThinkingDisplay(body)) {
    betas.push('redact-thinking-2026-02-12');
  }

  betas.push(
    'thinking-token-count-2026-05-13',
    'context-management-2025-06-27',
    'prompt-caching-scope-2026-01-05',
    'mid-conversation-system-2026-04-07',
  );
}

function appendFeatureBetas(betas: string[], body: JsonObject): void {
  if (hasTools(body)) {
    betas.push('advanced-tool-use-2025-11-20');
  }

  betas.push('effort-2025-11-24', 'fallback-credit-2026-06-01');

  if (usesFastMode(body)) {
    betas.push('fast-mode-2026-02-01');
  }

  betas.push('extended-cache-ttl-2025-04-11');

  if (isJsonObject(body['diagnostics'])) {
    betas.push('cache-diagnosis-2026-04-07');
  }
}

function hasOneMillionContext(body: JsonObject): boolean {
  return typeof body['model'] === 'string' && body['model'].includes('[1m]');
}

function hasThinkingDisplay(body: JsonObject): boolean {
  const thinking = body['thinking'];

  return (
    isJsonObject(thinking) &&
    typeof thinking['display'] === 'string' &&
    thinking['display'].trim() !== ''
  );
}

function hasTools(body: JsonObject): boolean {
  return Array.isArray(body['tools']) && body['tools'].length > 0;
}

function usesFastMode(body: JsonObject): boolean {
  return body['speed'] === 'fast';
}

export function claudeProviderRequest(
  providerOrigin: string,
  rawBody: JsonObject,
  accessToken: string,
  ids: ClaudeRequestIds,
): ProviderRequest {
  const { betas: _betas, ...body } = rawBody;

  return {
    url: `${providerOrigin.replace(/\/+$/u, '')}/v1/messages?beta=true`,
    body: JSON.stringify(body),
    headers: [
      ['Accept', 'application/json'],
      ['Authorization', `Bearer ${accessToken}`],
      ['Content-Type', 'application/json'],
      ['User-Agent', 'claude-cli/2.1.220 (external, cli)'],
      ['X-Claude-Code-Session-Id', ids.sessionId],
      ['X-Stainless-Arch', 'arm64'],
      ['X-Stainless-Lang', 'js'],
      ['X-Stainless-OS', 'MacOS'],
      ['X-Stainless-Package-Version', '0.94.0'],
      ['X-Stainless-Retry-Count', '0'],
      ['X-Stainless-Runtime', 'node'],
      ['X-Stainless-Runtime-Version', 'v26.3.0'],
      ['X-Stainless-Timeout', '600'],
      ['anthropic-beta', claudeBetas(body)],
      ['anthropic-dangerous-direct-browser-access', 'true'],
      ['anthropic-version', '2023-06-01'],
      ['x-app', 'cli'],
      ['x-client-request-id', ids.requestId],
      ['Connection', 'keep-alive'],
      ['Accept-Encoding', 'gzip, deflate, br, zstd'],
    ],
  };
}
