import type { JsonObject, ProxyDialect } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

export function ensureColonSpacedJSON(payload: Uint8Array): Uint8Array {
  const text = new TextDecoder().decode(payload);

  try {
    JSON.parse(text);
  } catch {
    return payload;
  }

  return new TextEncoder().encode(text.replaceAll(/":\s*/gu, '": '));
}

export function normalizeKimiToolMessageLinksRaw(payload: string): string {
  if (/"tool_call_id"\s*:/u.test(payload)) return payload;

  const linked = payload.replace(/"call_id"\s*:/gu, '"tool_call_id":');

  return linked.replace(
    /"content"\s*:\s*"([^"]*)"(?=\s*,\s*"tool_calls")/gu,
    '"content":"$1","reasoning_content":"$1"',
  );
}

export function openAICompatPromptCacheKey(
  body: JsonObject,
  options: { sessionId?: string; model: string; protocol: ProxyDialect },
): string | undefined {
  const caller = body['prompt_cache_key'];

  if (typeof caller === 'string' && caller.trim() !== '') return caller;
  if (options.sessionId === undefined) return undefined;

  return `${options.protocol}:${options.model}:${options.sessionId}`;
}

export function withOpenAICompatPromptCache(
  body: JsonObject,
  options: { sessionId?: string; model: string; protocol: ProxyDialect },
): JsonObject {
  const key = openAICompatPromptCacheKey(body, options);

  return key === undefined ? body : { ...body, prompt_cache_key: key };
}

export function applyOpenAICompatPayloadOverride(body: JsonObject): JsonObject {
  const override = body['provider_payload_override'];

  if (!isJsonObject(override)) return body;

  const { provider_payload_override: _override, ...base } = body;

  return { ...base, ...override };
}

export function rewriteOpenAICompatMultipart(form: FormData, model: string): FormData {
  const rewritten = new FormData();

  for (const [name, value] of form.entries()) rewritten.append(name, value);
  rewritten.set('model', model);

  return rewritten;
}
