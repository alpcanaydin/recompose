import type { Context } from 'hono';

import { createHash } from 'node:crypto';

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

function sessionHeader(c: Context): string | undefined {
  return [c.req.header('Session_id'), c.req.header('session_id'), c.req.header('Session-Id')]
    .map(validId)
    .find((value) => value !== undefined);
}

export function requestSessionId(c: Context, body: JsonObject): string | undefined {
  const candidates = [
    c.req.header('x-session-id'),
    c.req.header('x-claude-code-session-id'),
    sessionHeader(c),
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

function windowScope(c: Context, body: JsonObject): string | undefined {
  const metadata = body['client_metadata'];
  const bodyId = isJsonObject(metadata) ? metadata['x-codex-window-id'] : undefined;
  const id = validId(c.req.header('x-codex-window-id')) ?? validId(bodyId);

  return id === undefined ? undefined : `window:${id}`;
}

function firstScope(candidates: Array<string | undefined>): string | undefined {
  return candidates.find((value) => value !== undefined);
}

export function requestReplayScopeId(c: Context, body: JsonObject): string | undefined {
  return firstScope([
    namespaced('execution', c.req.header('x-session-id')),
    namespaced('responses', sessionHeader(c)),
    claudeScope(c, body),
    windowScope(c, body),
    namespaced('responses', body['session_id']),
    namespaced('responses', body['sessionId']),
    namespaced('responses', body['conversation_id']),
    namespaced('prompt-cache', body['prompt_cache_key']),
  ]);
}

export function requestCallerFingerprint(c: Context): string | undefined {
  const credential = c.req.header('authorization') ?? c.req.header('x-api-key');

  if (credential === undefined || credential.trim() === '') return undefined;

  return createHash('sha256').update(credential.trim()).digest('hex');
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
