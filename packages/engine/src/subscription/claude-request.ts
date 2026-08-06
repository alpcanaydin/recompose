import type { ClaudeIdentity } from './claude-identity';

import { isJsonObject } from '../gateway-wire';
import { applyClaudeCredentialIdentity } from './claude-identity';
import { sanitizeClaudeSignatures } from './claude-signatures';
import { prepareClaudeTools } from './claude-tools';

export type ProviderRequest = {
  url: string;
  headers: [string, string][];
  body: string;
  reverseToolNames?: Record<string, string>;
};

type JsonObject = Record<string, unknown>;

type ClaudeRequestIds = {
  sessionId: string;
  requestId: string;
};

type CacheBlock = JsonObject & { cache_control?: unknown };

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

function cacheBlocksIn(value: unknown): CacheBlock[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is CacheBlock => isJsonObject(item) && item['cache_control'] !== undefined,
      )
    : [];
}

function messageCacheBlocks(body: JsonObject): CacheBlock[] {
  const messages = Array.isArray(body['messages']) ? body['messages'] : [];

  return messages.flatMap((message) =>
    isJsonObject(message) ? cacheBlocksIn(message['content']) : [],
  );
}

function cacheSections(body: JsonObject): {
  tools: CacheBlock[];
  system: CacheBlock[];
  messages: CacheBlock[];
} {
  return {
    tools: cacheBlocksIn(body['tools']),
    system: cacheBlocksIn(body['system']),
    messages: messageCacheBlocks(body),
  };
}

function isOneHourControl(control: unknown): control is JsonObject {
  return isJsonObject(control) && control['ttl'] === '1h';
}

function normalizeCacheTtls(body: JsonObject): void {
  const sections = cacheSections(body);
  let seenFiveMinutes = false;

  for (const block of [...sections.tools, ...sections.system, ...sections.messages]) {
    const control = block.cache_control;
    const isOneHour = isOneHourControl(control);

    if (seenFiveMinutes && isOneHour) {
      delete control['ttl'];
    }

    seenFiveMinutes ||= !isOneHour;
  }
}

function withoutLast<T>(values: T[]): T[] {
  return values.slice(0, -1);
}

function enforceCacheLimit(body: JsonObject): void {
  const sections = cacheSections(body);
  const all = [...sections.tools, ...sections.system, ...sections.messages];
  const excess = all.length - 4;
  const removalOrder = [
    ...withoutLast(sections.system),
    ...withoutLast(sections.tools),
    ...sections.messages,
    ...sections.system.slice(-1),
    ...sections.tools.slice(-1),
  ];

  for (const block of removalOrder.slice(0, Math.max(0, excess))) {
    delete block.cache_control;
  }
}

function webSearchTool(value: unknown): JsonObject | null {
  return isJsonObject(value) && String(value['type']).startsWith('web_search_') ? value : null;
}

function removeEmptyDomainLists(tool: JsonObject): void {
  for (const field of ['allowed_domains', 'blocked_domains']) {
    const domains = tool[field];

    if (Array.isArray(domains) && domains.length === 0) {
      delete tool[field];
    }
  }
}

function sanitizeWebSearchDomains(body: JsonObject): void {
  const tools = Array.isArray(body['tools']) ? body['tools'] : [];

  for (const value of tools) {
    const tool = webSearchTool(value);

    if (tool !== null) {
      removeEmptyDomainLists(tool);
    }
  }
}

function normalizedCacheControls(body: JsonObject): JsonObject {
  const cloned = structuredClone(body);

  normalizeCacheTtls(cloned);
  enforceCacheLimit(cloned);
  sanitizeWebSearchDomains(cloned);

  return cloned;
}

function isForcedToolChoice(choice: unknown): boolean {
  return isJsonObject(choice) && (choice['type'] === 'any' || choice['type'] === 'tool');
}

function withoutEffort(outputConfig: unknown, rest: JsonObject): JsonObject {
  if (!isJsonObject(outputConfig)) {
    return rest;
  }

  const { effort: _effort, ...remaining } = outputConfig;

  return Object.keys(remaining).length === 0 ? rest : { ...rest, output_config: remaining };
}

function withoutForcedThinking(body: JsonObject): JsonObject {
  const choice = body['tool_choice'];

  if (!isForcedToolChoice(choice)) {
    return body;
  }

  const { thinking: _thinking, output_config: outputConfig, ...rest } = body;

  return withoutEffort(outputConfig, rest);
}

function normalizedClaudeBody(rawBody: JsonObject): JsonObject {
  const forcedSafe = withoutForcedThinking(rawBody);
  const { betas: _betas, temperature: _temperature, top_p: _topP, ...body } = forcedSafe;
  const signatureSafe = sanitizeClaudeSignatures(body);
  const thinking = signatureSafe['thinking'];
  const type = isJsonObject(thinking) ? thinking['type'] : undefined;

  if (type !== 'enabled' && type !== 'adaptive' && type !== 'auto') {
    return normalizedCacheControls(signatureSafe);
  }

  const { top_k: _topK, ...thinkingSafe } = signatureSafe;

  return normalizedCacheControls(thinkingSafe);
}

export function claudeProviderRequest(
  providerOrigin: string,
  rawBody: JsonObject,
  accessToken: string,
  ids: ClaudeRequestIds,
  identity?: ClaudeIdentity,
): ProviderRequest {
  const identified =
    identity === undefined
      ? rawBody
      : applyClaudeCredentialIdentity(rawBody, identity, ids.sessionId);
  const body = normalizedClaudeBody(identified);
  const prepared = prepareClaudeTools(body, 'recompose-claude-mcp-caller');

  return {
    url: `${providerOrigin.replace(/\/+$/u, '')}/v1/messages?beta=true`,
    body: JSON.stringify(prepared.body),
    ...(Object.keys(prepared.reverse).length === 0 ? {} : { reverseToolNames: prepared.reverse }),
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
