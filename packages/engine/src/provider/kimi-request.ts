import type { JsonObject, ProxyDialect } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

type ParsedKimiModel = { base: string; suffix?: string };
const KIMI_SUFFIX = /\(([^()]*)\)\s*$/u;
const KIMI_EFFORTS = new Map([
  ['minimal', 'low'],
  ['low', 'low'],
  ['medium', 'medium'],
  ['high', 'high'],
  ['xhigh', 'high'],
  ['max', 'high'],
]);

function withoutSuffix(model: string, match: RegExpExecArray | null): string {
  return match === null ? model : model.slice(0, match.index).trim();
}

function parsedKimiModel(model: string): ParsedKimiModel {
  const trimmed = model.trim();
  const suffixMatch = KIMI_SUFFIX.exec(trimmed);
  const withoutContext = withoutSuffix(trimmed, suffixMatch).replace(/\[1m\]$/iu, '');
  const withoutPrefix = withoutContext.replace(/^kimi-/iu, '');
  const suffix = suffixMatch?.[1]?.trim();

  return {
    base: withoutPrefix.trim().toLowerCase(),
    ...(suffix === undefined || suffix === '' ? {} : { suffix }),
  };
}

export function normalizeKimiUpstreamModel(model: string): string {
  const parsed = parsedKimiModel(model);

  return parsed.suffix === undefined ? parsed.base : `${parsed.base}(${parsed.suffix})`;
}

function kimiEffort(suffix: string | undefined): string | undefined {
  return suffix === undefined ? undefined : KIMI_EFFORTS.get(suffix.toLowerCase());
}

function withClaudeEffort(body: JsonObject, effort: string): JsonObject {
  const outputConfig = body['output_config'];

  return {
    ...body,
    output_config: {
      ...(isJsonObject(outputConfig) ? outputConfig : {}),
      effort,
    },
  };
}

function withChatEffort(body: JsonObject, effort: string): JsonObject {
  const thinking = body['thinking'];

  return {
    ...body,
    thinking: {
      ...(isJsonObject(thinking) ? thinking : {}),
      type: 'enabled',
      effort,
    },
  };
}

export function kimiProviderBody(
  body: JsonObject,
  requestedModel: string,
  sourceDialect: ProxyDialect,
): JsonObject {
  const parsed = parsedKimiModel(requestedModel);
  const normalized = { ...body, model: parsed.base };
  const effort = kimiEffort(parsed.suffix);

  if (effort === undefined) return normalized;

  return sourceDialect === 'anthropic'
    ? withClaudeEffort(normalized, effort)
    : withChatEffort(normalized, effort);
}
