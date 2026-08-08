import type { JsonObject, ProxyDialect } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { normalizeKimiToolHistory } from './kimi-tool-history';
import { mapReasoningLevel } from './reasoning-capabilities';

type ParsedKimiModel = { base: string; suffix?: string };
const KIMI_SUFFIX = /\(([^()]*)\)\s*$/u;
const KIMI_LEVELS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const KIMI_CAPABILITIES = { levels: ['low', 'medium', 'high'] } as const;

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
  const level = suffix?.toLowerCase();

  return level === undefined || !KIMI_LEVELS.has(level)
    ? undefined
    : mapReasoningLevel(level, KIMI_CAPABILITIES, false);
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
  const configured =
    effort === undefined
      ? normalized
      : sourceDialect === 'anthropic'
        ? withClaudeEffort(normalized, effort)
        : withChatEffort(normalized, effort);

  return sourceDialect === 'anthropic' ? configured : normalizeKimiToolHistory(configured);
}
