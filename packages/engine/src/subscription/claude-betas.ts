import { isJsonObject } from '../gateway-wire';

type JsonObject = Record<string, unknown>;

export function requestedClaudeBetas(body: JsonObject): Set<string> {
  const betas = body['betas'];

  return new Set(
    Array.isArray(betas) ? betas.filter((beta): beta is string => typeof beta === 'string') : [],
  );
}

export function claudeBetas(body: JsonObject, requested: Set<string>): string {
  const betas = ['claude-code-20250219', 'oauth-2025-04-20'];

  appendThinkingBetas(betas, body);
  appendFeatureBetas(betas, body, requested);

  return betas.join(',');
}

function appendThinkingBetas(betas: string[], body: JsonObject): void {
  if (typeof body['model'] === 'string' && body['model'].includes('[1m]')) {
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

function hasThinkingDisplay(body: JsonObject): boolean {
  const thinking = body['thinking'];

  return (
    isJsonObject(thinking) &&
    typeof thinking['display'] === 'string' &&
    thinking['display'].trim() !== ''
  );
}

function appendFeatureBetas(betas: string[], body: JsonObject, requested: Set<string>): void {
  if (Array.isArray(body['tools']) && body['tools'].length > 0) {
    betas.push('advanced-tool-use-2025-11-20');
  }

  betas.push('effort-2025-11-24');
  appendFallbackBetas(betas, requested);

  if (body['speed'] === 'fast') {
    betas.push('fast-mode-2026-02-01');
  }

  betas.push('extended-cache-ttl-2025-04-11');

  if (isJsonObject(body['diagnostics'])) {
    betas.push('cache-diagnosis-2026-04-07');
  }
}

function appendFallbackBetas(betas: string[], requested: Set<string>): void {
  const fallbackCredit = 'fallback-credit-2026-06-01';

  if (!requested.has(fallbackCredit)) {
    betas.push(fallbackCredit);
  }

  for (const beta of [
    'server-side-fallback-2026-06-01',
    fallbackCredit,
    'structured-outputs-2025-12-15',
  ]) {
    if (requested.has(beta)) {
      betas.push(beta);
    }
  }
}
