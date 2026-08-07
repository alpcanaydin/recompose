import type { Context } from 'hono';

import type { JsonObject } from './gateway-wire';

import { isJsonObject, parsedJson } from './gateway-wire';

function invalidCharacter(value: string): boolean {
  return value.split('').some((character) => {
    const code = character.codePointAt(0) ?? 0;

    return code <= 32 || code === 127;
  });
}

function validId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 256 && !invalidCharacter(value)
    ? value
    : undefined;
}

function metadataId(body: JsonObject): string | undefined {
  const metadata = body['metadata'];

  if (!isJsonObject(metadata) || typeof metadata['user_id'] !== 'string') return undefined;

  const user = parsedJson(metadata['user_id']);

  return isJsonObject(user) ? validId(user['session_id']) : undefined;
}

export function requestSessionId(c: Context, body: JsonObject): string | undefined {
  const candidates = [
    c.req.header('x-session-id'),
    c.req.header('x-claude-code-session-id'),
    body['session_id'],
    body['sessionId'],
    body['conversation_id'],
    body['prompt_cache_key'],
    metadataId(body),
  ];

  return candidates.map(validId).find((value) => value !== undefined);
}

function namespaced(prefix: string, value: unknown): string | undefined {
  const id = validId(value);

  return id === undefined ? undefined : `${prefix}:${id}`;
}

function claudeScope(c: Context, body: JsonObject): string | undefined {
  const id = validId(c.req.header('x-claude-code-session-id')) ?? metadataId(body);

  if (id === undefined) return undefined;

  const agent = validId(c.req.header('x-claude-code-agent-id')) ?? 'main';

  return `claude:${id}:agent:${agent}`;
}

function firstScope(candidates: Array<string | undefined>): string | undefined {
  return candidates.find((value) => value !== undefined);
}

export function requestReplayScopeId(c: Context, body: JsonObject): string | undefined {
  return firstScope([
    namespaced('execution', c.req.header('x-session-id')),
    namespaced('responses', c.req.header('session-id')),
    claudeScope(c, body),
    namespaced('responses', body['session_id']),
    namespaced('responses', body['sessionId']),
    namespaced('responses', body['conversation_id']),
    namespaced('prompt-cache', body['prompt_cache_key']),
  ]);
}

export function requestSessions(
  c: Context,
  body: JsonObject,
): { sessionId?: string; replayScopeId?: string } {
  const sessionId = requestSessionId(c, body);
  const replayScopeId = requestReplayScopeId(c, body);

  return {
    ...(sessionId === undefined ? {} : { sessionId }),
    ...(replayScopeId === undefined ? {} : { replayScopeId }),
  };
}

export function requestsResponsesLite(c: Context): boolean {
  return c.req.header('x-openai-internal-codex-responses-lite')?.trim().toLowerCase() === 'true';
}
