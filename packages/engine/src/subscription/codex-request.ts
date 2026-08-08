import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';

import { isJsonObject } from '../gateway-wire';
import { modelOverrideHeaders } from '../provider/model-metadata';
import {
  boundedCodexCallId,
  dropsCodexEncryptedReasoning,
  normalizedCodexItemId,
  sanitizedCodexReasoning,
} from './codex-identities';
import { codexResponsesLite, injectCodexImageTool } from './codex-image-tools';
import { optimizeCodexMultiAgent } from './codex-multi-agent';
import { CODEX_ORIGINATOR, codexRequestHeaders, CODEX_USER_AGENT } from './codex-request-headers';

type JsonObject = Record<string, unknown>;

const WEB_SEARCH_ALIASES = new Set(['web_search_preview', 'web_search_preview_2025_03_11']);

export { CODEX_ORIGINATOR, CODEX_USER_AGENT };

const REMOVED_FIELDS = [
  'previous_response_id',
  'generate',
  'prompt_cache_retention',
  'safety_identifier',
  'stream_options',
  'max_output_tokens',
  'max_completion_tokens',
  'temperature',
  'top_p',
  'truncation',
  'user',
  'context_management',
] as const;

function messageInput(input: string): JsonObject[] {
  return [
    {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: input }],
    },
  ];
}

function developerInput(input: unknown): unknown {
  if (typeof input === 'string') {
    return messageInput(input);
  }

  if (!Array.isArray(input)) {
    return input;
  }

  return input.map((item: unknown) => {
    if (!isJsonObject(item)) {
      return item;
    }

    return item['role'] === 'system' ? { ...item, role: 'developer' } : item;
  });
}

function searchObject(value: JsonObject): JsonObject {
  const entry: JsonObject = { ...value };
  const type = entry['type'];

  if (typeof type === 'string' && WEB_SEARCH_ALIASES.has(type)) {
    entry['type'] = 'web_search';
  }

  return entry;
}

function searchEntry(value: unknown): unknown {
  return isJsonObject(value) ? searchObject(value) : value;
}

function searchEntries(value: unknown): unknown {
  return Array.isArray(value) ? value.map(searchEntry) : value;
}

function toolChoice(value: unknown): unknown {
  const normalized = searchEntry(value);

  if (!isJsonObject(normalized)) {
    return normalized;
  }

  return { ...normalized, tools: searchEntries(normalized['tools']) };
}

function baseToolName(name: string): string {
  if (name.length <= 64) {
    return name;
  }

  const separator = name.startsWith('mcp__') ? name.lastIndexOf('__') : -1;
  const candidate = separator > 0 ? `mcp__${name.slice(separator + 2)}` : name;

  return candidate.slice(0, 64);
}

function uniqueToolName(candidate: string, used: Set<string>): string {
  if (!used.has(candidate)) {
    return candidate;
  }

  for (let index = 1; ; index += 1) {
    const suffix = `_${String(index)}`;
    const name = `${candidate.slice(0, 64 - suffix.length)}${suffix}`;

    if (!used.has(name)) {
      return name;
    }
  }
}

function toolNameMap(value: unknown): Map<string, string> {
  const names = Array.isArray(value) ? value.flatMap(toolNameOf) : [];
  const mapped = new Map<string, string>();
  const used = new Set<string>();

  for (const name of names) {
    const bounded = uniqueToolName(baseToolName(name), used);

    mapped.set(name, bounded);
    used.add(bounded);
  }

  return mapped;
}

function toolNameOf(value: unknown): string[] {
  const entry = searchEntry(value);
  const name = isJsonObject(entry) ? entry['name'] : undefined;

  return typeof name === 'string' ? [name] : [];
}

function renamedObjectEntry(value: JsonObject, names: Map<string, string>): JsonObject {
  const normalized = sanitizedCodexReasoning(searchObject(value));

  const originalName = normalized['name'];
  const name = typeof originalName === 'string' ? names.get(originalName) : undefined;
  const id = normalizedCodexItemId(normalized);

  return {
    ...normalized,
    ...renamedIdentityFields(normalized, name, id),
  };
}

function renamedEntry(value: unknown, names: Map<string, string>): unknown {
  return isJsonObject(value) ? renamedObjectEntry(value, names) : value;
}

function renamedIdentityFields(
  normalized: JsonObject,
  name: string | undefined,
  id: string | undefined,
): JsonObject {
  return {
    ...(name === undefined ? {} : { name }),
    ...(id === undefined ? {} : { id }),
    ...('call_id' in normalized ? { call_id: boundedCodexCallId(normalized['call_id']) } : {}),
  };
}

function renamedEntries(value: unknown, names: Map<string, string>): unknown {
  return Array.isArray(value)
    ? value.flatMap((entry) =>
        isJsonObject(entry) && dropsCodexEncryptedReasoning(entry)
          ? []
          : [renamedEntry(entry, names)],
      )
    : value;
}

function renamedToolChoice(value: unknown, names: Map<string, string>): unknown {
  const choice = toolChoice(value);

  if (!isJsonObject(choice)) {
    return choice;
  }

  const entry = renamedObjectEntry(choice, names);

  return { ...entry, tools: renamedEntries(entry['tools'], names) };
}

function normalizedToolBody(rawBody: JsonObject): JsonObject {
  const body: JsonObject = { ...rawBody };
  const names = toolNameMap(body['tools']);

  body['input'] = renamedEntries(developerInput(body['input']), names);
  body['tools'] = renamedEntries(body['tools'], names);
  body['tool_choice'] = renamedToolChoice(body['tool_choice'], names);
  body['instructions'] ??= '';

  return body;
}

function normalizedBody(
  rawBody: JsonObject,
  planType: string | undefined,
  forcedResponsesLite: boolean,
): JsonObject {
  const body = normalizedToolBody(rawBody);

  for (const field of REMOVED_FIELDS) {
    delete body[field];
  }

  if (body['service_tier'] !== 'priority') {
    delete body['service_tier'];
  }

  body['stream'] = true;
  body['store'] = false;
  injectCodexImageTool(body, planType, forcedResponsesLite);
  normalizeParallelToolCalls(body, forcedResponsesLite);
  body['include'] = ['reasoning.encrypted_content'];

  return body;
}

function normalizedCompactBody(rawBody: JsonObject): JsonObject {
  const body = normalizedToolBody(rawBody);

  delete body['stream'];

  return body;
}

function isResponsesLite(body: JsonObject, forced: boolean): boolean {
  return forced || codexResponsesLite(body);
}

function normalizeParallelToolCalls(body: JsonObject, forcedResponsesLite: boolean): void {
  const tools = body['tools'];

  if (isResponsesLite(body, forcedResponsesLite)) {
    body['parallel_tool_calls'] = false;
  } else if (!Array.isArray(tools) || tools.length === 0) {
    delete body['parallel_tool_calls'];
  } else if (typeof body['parallel_tool_calls'] !== 'boolean') {
    body['parallel_tool_calls'] = true;
  }
}

export function codexProviderRequest(
  providerOrigin: string,
  rawBody: JsonObject,
  credential: ParsedSubscriptionCredential,
  sessionId: string,
  responsesLite = false,
  promptCacheKey = sessionId,
  compact = false,
): ProviderRequest {
  const body = codexRequestBody(rawBody, credential, responsesLite, promptCacheKey, compact);
  const headers = withModelHeaderOverrides(
    codexRequestHeaders(credential, sessionId, compact),
    rawBody['model'],
  );

  return {
    url: `${providerOrigin.replace(/\/+$/u, '')}/responses${compact ? '/compact' : ''}`,
    headers,
    body: JSON.stringify(body),
  };
}

function withModelHeaderOverrides(headers: [string, string][], model: unknown): [string, string][] {
  const overrides = typeof model === 'string' ? modelOverrideHeaders(model) : undefined;

  if (overrides === undefined) return headers;

  return headers.map(([name, value]) => [name, overrides[name.toLowerCase()] ?? value]);
}

function codexRequestBody(
  rawBody: JsonObject,
  credential: ParsedSubscriptionCredential,
  responsesLite: boolean,
  promptCacheKey: string,
  compact: boolean,
): JsonObject {
  const normalized = compact
    ? normalizedCompactBody(rawBody)
    : normalizedBody(rawBody, credential.planType, responsesLite);
  const body = optimizeCodexMultiAgent(normalized);

  body['prompt_cache_key'] = promptCacheKey;

  return body;
}
