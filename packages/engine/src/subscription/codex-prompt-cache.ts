import { createHash } from 'node:crypto';

import type { JsonObject } from '../gateway-wire';

const oidNamespace = Buffer.from('6ba7b8129dad11d180b400c04fd430c8', 'hex');

function formattedUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

function uuidV5(value: string): string {
  const bytes = createHash('sha1').update(oidNamespace).update(value).digest().subarray(0, 16);

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  return formattedUuid(bytes);
}

export function codexPromptCacheKey(
  body: JsonObject,
  replayScopeId: string,
  sessionId: string,
): string {
  const model = body['model'];

  if (typeof model !== 'string' || model.trim() === '' || !replayScopeId.startsWith('claude:')) {
    return sessionId;
  }

  const identity = ['cli-proxy-api:codex:claude-code', model.trim(), replayScopeId].join('\0');

  return uuidV5(identity);
}
