import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';

import { isJsonObject } from '../gateway-wire';
import {
  boundedCodexCallId,
  dropsCodexEncryptedReasoning,
  normalizedCodexItemId,
} from './codex-identities';
import { codexResponsesLite, injectCodexImageTool } from './codex-image-tools';

type JsonObject = Record<string, unknown>;

const WEB_SEARCH_ALIASES = new Set(['web_search_preview', 'web_search_preview_2025_03_11']);

export const CODEX_USER_AGENT =
  'codex-tui/0.146.0 (Mac OS 26.5.0; arm64) iTerm.app/3.6.10 (codex-tui; 0.146.0)';
export const CODEX_ORIGINATOR = 'codex-tui';

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

function searchEntry(value: unknown): unknown {
  if (!isJsonObject(value)) {
    return value;
  }

  const entry: JsonObject = { ...value };
  const type = entry['type'];

  if (typeof type === 'string' && WEB_SEARCH_ALIASES.has(type)) {
    entry['type'] = 'web_search';
  }

  return entry;
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

function renamedEntry(value: unknown, names: Map<string, string>): unknown {
  const normalized = searchEntry(value);

  if (!isJsonObject(normalized)) {
    return normalized;
  }

  const originalName = normalized['name'];
  const name = typeof originalName === 'string' ? names.get(originalName) : undefined;
  const id = normalizedCodexItemId(normalized);

  return {
    ...normalized,
    ...renamedIdentityFields(normalized, name, id),
  };
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

  const entry = renamedEntry(choice, names);

  return isJsonObject(entry) ? { ...entry, tools: renamedEntries(entry['tools'], names) } : entry;
}

function normalizedBody(
  rawBody: JsonObject,
  planType: string | undefined,
  forcedResponsesLite: boolean,
): JsonObject {
  const body: JsonObject = { ...rawBody };

  for (const field of REMOVED_FIELDS) {
    delete body[field];
  }

  if (body['service_tier'] !== 'priority') {
    delete body['service_tier'];
  }

  const names = toolNameMap(body['tools']);

  body['input'] = renamedEntries(developerInput(body['input']), names);
  body['tools'] = renamedEntries(body['tools'], names);
  body['tool_choice'] = renamedToolChoice(body['tool_choice'], names);
  body['stream'] = true;
  body['store'] = false;
  injectCodexImageTool(body, planType, forcedResponsesLite);
  normalizeParallelToolCalls(body, forcedResponsesLite);
  body['include'] = ['reasoning.encrypted_content'];
  body['instructions'] ??= '';

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
): ProviderRequest {
  const body = normalizedBody(rawBody, credential.planType, responsesLite);

  body['prompt_cache_key'] = sessionId;

  const headers: [string, string][] = [
    ['Content-Type', 'application/json'],
    ['Authorization', `Bearer ${credential.accessToken}`],
    ['User-Agent', CODEX_USER_AGENT],
    ['Session_id', sessionId],
    ['Accept', 'text/event-stream'],
    ['Connection', 'Keep-Alive'],
    ['Originator', CODEX_ORIGINATOR],
  ];

  if (credential.accountId !== undefined) {
    headers.push(['Chatgpt-Account-Id', credential.accountId]);
  }

  return {
    url: `${providerOrigin.replace(/\/+$/u, '')}/responses`,
    headers,
    body: JSON.stringify(body),
  };
}
