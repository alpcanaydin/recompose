import type { ClaudeIdentity } from './claude-identity';

import { isJsonObject } from '../gateway-wire';
import { claudeBetas, requestedClaudeBetas } from './claude-betas';
import { ensureClaudeCacheControls } from './claude-cache-control';
import { signedClaudeBody } from './claude-cch';
import { withClaudeContextManagement } from './claude-context';
import { CLAUDE_CODE_220_PROFILE, type ClaudeDeviceProfile } from './claude-device-profile';
import { applyClaudeCredentialIdentity } from './claude-identity';
import { withClaudeMaxTokens } from './claude-models';
import {
  applyClaudePayloadFinalPolicy,
  applyClaudePayloadOverrides,
  payloadSystemPolicy,
  type ClaudePayloadPolicy,
} from './claude-payload-policy';
import { sanitizeClaudeSignatures } from './claude-signatures';
import { claudeCountTokensSystem, claudeMessagesSystem } from './claude-system';
import { applyClaudeSystemPolicy, type ClaudeSystemPolicy } from './claude-system-policy';
import { prepareClaudeTools } from './claude-tools';
import { claudeWireHeaders } from './claude-wire-headers';

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
  const cloned = ensureClaudeCacheControls(body);

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

function identifiedBody(
  body: JsonObject,
  identity: ClaudeIdentity | undefined,
  sessionId: string,
): JsonObject {
  return identity === undefined ? body : applyClaudeCredentialIdentity(body, identity, sessionId);
}

function shapedSystemBody(
  body: JsonObject,
  now: number,
  mode: 'messages' | 'count-tokens',
  timezone?: string,
): JsonObject {
  return mode === 'count-tokens'
    ? claudeCountTokensSystem(body)
    : claudeMessagesSystem(body, now, timezone);
}

function messageFeatures(body: JsonObject, mode: 'messages' | 'count-tokens'): JsonObject {
  return mode === 'messages' ? withClaudeMaxTokens(body) : body;
}

function isAnthropicUpstream(providerOrigin: string): boolean {
  try {
    const origin = new URL(providerOrigin);

    if (origin.username !== '' || origin.password !== '') return false;

    return origin.origin.toLowerCase() === 'https://api.anthropic.com';
  } catch {
    return false;
  }
}

function upstreamFeatures(
  body: JsonObject,
  providerOrigin: string,
  mode: 'messages' | 'count-tokens',
): JsonObject {
  return mode === 'messages' && isAnthropicUpstream(providerOrigin)
    ? withClaudeContextManagement(body)
    : body;
}

export function claudeProviderRequest(
  providerOrigin: string,
  rawBody: JsonObject,
  accessToken: string,
  ids: ClaudeRequestIds,
  identity?: ClaudeIdentity,
  now = Date.now(),
  mode: 'messages' | 'count-tokens' = 'messages',
  timezone?: string,
  systemPolicy?: ClaudeSystemPolicy,
  payloadPolicy?: ClaudePayloadPolicy,
  wireProfile: ClaudeDeviceProfile = CLAUDE_CODE_220_PROFILE,
): ProviderRequest {
  const overrideBody = applyClaudePayloadOverrides(rawBody, payloadPolicy);
  const requested = requestedClaudeBetas(overrideBody);
  const effectiveSystemPolicy = payloadSystemPolicy(systemPolicy, payloadPolicy);
  const policyBody = applyClaudeSystemPolicy(overrideBody, effectiveSystemPolicy);
  const identified = identifiedBody(policyBody, identity, ids.sessionId);
  const shaped = shapedSystemBody(identified, now, mode, timezone);
  const featured = messageFeatures(normalizedClaudeBody(shaped), mode);
  const upstream = upstreamFeatures(featured, providerOrigin, mode);
  const body = applyClaudePayloadFinalPolicy(upstream, payloadPolicy);
  const prepared = prepareClaudeTools(body, 'recompose-claude-mcp-caller');

  return {
    url: `${providerOrigin.replace(/\/+$/u, '')}/v1/messages?beta=true`,
    body: signedClaudeBody(prepared.body),
    ...(Object.keys(prepared.reverse).length === 0 ? {} : { reverseToolNames: prepared.reverse }),
    headers: claudeWireHeaders(
      accessToken,
      ids.sessionId,
      ids.requestId,
      claudeBetas(body, requested),
      wireProfile,
    ),
  };
}
