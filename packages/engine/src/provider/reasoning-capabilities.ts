import type { JsonObject } from '../gateway-wire';
import type { ReasoningDialect, ReasoningIntent } from './reasoning-types';

import { isJsonObject } from '../gateway-wire';
import { applyReasoningIntent } from './reasoning-capability-output';

export type ReasoningCapabilities = {
  dynamicAllowed?: boolean;
  levels?: readonly string[];
  maxBudget?: number;
  minBudget?: number;
  zeroAllowed?: boolean;
};

type ApplyOptions = {
  body: JsonObject;
  capabilities: ReasoningCapabilities;
  model: string;
  source: JsonObject;
  sourceDialect: ReasoningDialect;
  strict?: boolean;
  targetDialect: ReasoningDialect;
};

const LEVEL_ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
const LEVELS = new Set<string>(LEVEL_ORDER);
const SUFFIX = /\(([^()]*)\)\s*$/u;

function parsedSuffix(model: string): { intent?: ReasoningIntent; model: string } {
  const match = SUFFIX.exec(model.trim());

  if (match === null) return { model: model.trim() };

  const raw = match[1]?.trim().toLowerCase() ?? '';
  const base = model.slice(0, match.index).trim();
  const intent = suffixIntent(raw);

  return intent === undefined ? { model: model.trim() } : { intent, model: base };
}

export function reasoningModelBase(model: string): string {
  return parsedSuffix(model).model;
}

function suffixIntent(value: string): ReasoningIntent | undefined {
  const named = namedSuffixIntent(value);

  if (named !== undefined) return named;

  const budget = /^\d+$/u.test(value) ? Number(value) : Number.NaN;

  return Number.isSafeInteger(budget) ? { kind: 'budget', budget } : undefined;
}

function namedSuffixIntent(value: string): ReasoningIntent | undefined {
  if (value === 'none') return { kind: 'none' };
  if (value === 'auto' || value === '-1') return { kind: 'auto' };

  return LEVELS.has(value) ? { kind: 'level', level: value } : undefined;
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function nestedEffort(source: JsonObject, key: string): string | undefined {
  const value = source[key];

  return isJsonObject(value) ? stringField(value['effort']) : undefined;
}

function effortIn(source: JsonObject, dialect: ReasoningDialect): string | undefined {
  if (dialect === 'chat-completions') return stringField(source['reasoning_effort']);
  if (dialect === 'responses') return nestedEffort(source, 'reasoning');
  if (dialect === 'interactions') return nestedEffort(source, 'generation_config');
  if (dialect === 'gemini') return geminiEffort(source);

  return nestedEffort(source, 'output_config');
}

function geminiEffort(source: JsonObject): string | undefined {
  const generation = source['generationConfig'];
  const thinking = isJsonObject(generation) ? generation['thinkingConfig'] : undefined;

  return isJsonObject(thinking) ? stringField(thinking['thinkingLevel']) : undefined;
}

function sourceIntent(source: JsonObject, dialect: ReasoningDialect): ReasoningIntent | undefined {
  const effort = effortIn(source, dialect)?.trim().toLowerCase();

  return effort === undefined || effort === '' ? undefined : effortIntent(effort);
}

function effortIntent(effort: string): ReasoningIntent {
  if (effort === 'none') return { kind: 'none' };
  if (effort === 'auto') return { kind: 'auto' };

  return { kind: 'level', level: effort };
}

function normalizedLevels(capabilities: ReasoningCapabilities): string[] {
  return [...new Set((capabilities.levels ?? []).map((level) => level.trim().toLowerCase()))];
}

function highCandidates(level: string): readonly string[] {
  if (level === 'xhigh') return ['xhigh', 'max', 'high'];
  if (level === 'max') return ['max', 'xhigh', 'high'];

  return [];
}

function levelPosition(level: string): number {
  return LEVEL_ORDER.findIndex((candidate) => candidate === level);
}

type LevelCandidate = { distance: number; level: string; position: number };

function levelCandidate(level: string, requested: number): LevelCandidate | undefined {
  const position = levelPosition(level);

  return position < 0 ? undefined : { distance: Math.abs(position - requested), level, position };
}

function betterCandidate(candidate: LevelCandidate, best: LevelCandidate | undefined): boolean {
  if (best === undefined || candidate.distance < best.distance) return true;

  return candidate.distance === best.distance && candidate.position < best.position;
}

function chosenCandidate(
  candidate: LevelCandidate | undefined,
  best: LevelCandidate | undefined,
): LevelCandidate | undefined {
  if (candidate === undefined) return best;

  return betterCandidate(candidate, best) ? candidate : best;
}

function nearestLevel(level: string, supported: readonly string[]): string | undefined {
  const requested = levelPosition(level);

  if (requested < 0) return undefined;

  let best: LevelCandidate | undefined;

  for (const candidate of supported) {
    best = chosenCandidate(levelCandidate(candidate, requested), best);
  }

  return best?.level;
}

function acceptsLevel(level: string, supported: readonly string[]): boolean {
  return supported.length === 0 || supported.includes(level);
}

function mappedUnsupportedLevel(
  level: string,
  supported: readonly string[],
  strict: boolean,
): string {
  if (strict) throw new Error(`Unsupported reasoning level "${level}"`);

  const supportedSet = new Set(supported);
  const high = highCandidates(level).find((candidate) => supportedSet.has(candidate));

  return high ?? nearestLevel(level, supported) ?? level;
}

export function mapReasoningLevel(
  level: string,
  capabilities: ReasoningCapabilities,
  strict: boolean,
): string {
  const normalized = level.trim().toLowerCase();
  const supported = normalizedLevels(capabilities);

  return acceptsLevel(normalized, supported)
    ? normalized
    : mappedUnsupportedLevel(normalized, supported, strict);
}

function clampBudget(budget: number, capabilities: ReasoningCapabilities): number {
  const minimum = capabilities.minBudget ?? 0;
  const maximum = capabilities.maxBudget ?? Number.MAX_SAFE_INTEGER;
  const nonzero = budget === 0 && capabilities.zeroAllowed === false ? minimum : budget;

  return Math.min(Math.max(nonzero, minimum), maximum);
}

function normalizedNone(capabilities: ReasoningCapabilities): ReasoningIntent {
  const levels = normalizedLevels(capabilities);

  if (capabilities.zeroAllowed === true || levels.includes('none'))
    return { kind: 'level', level: 'none' };

  if (levels.length > 0) return { kind: 'level', level: levels[0] ?? 'low' };

  return { kind: 'budget', budget: clampBudget(0, capabilities) };
}

function normalizedAuto(capabilities: ReasoningCapabilities): ReasoningIntent {
  if (capabilities.dynamicAllowed === true) return { kind: 'auto' };

  const levels = normalizedLevels(capabilities);

  if (levels.length > 0) {
    return { kind: 'level', level: mapReasoningLevel('medium', capabilities, false) };
  }

  const minimum = capabilities.minBudget ?? 0;
  const maximum = capabilities.maxBudget ?? minimum;

  return { kind: 'budget', budget: clampBudget(Math.floor((minimum + maximum) / 2), capabilities) };
}

function normalizedIntent(
  intent: ReasoningIntent,
  capabilities: ReasoningCapabilities,
  strict: boolean,
): ReasoningIntent {
  if (intent.kind === 'level') {
    return { kind: 'level', level: mapReasoningLevel(intent.level, capabilities, strict) };
  }

  if (intent.kind === 'budget') {
    return { kind: 'budget', budget: clampBudget(intent.budget, capabilities) };
  }

  if (intent.kind === 'none') return normalizedNone(capabilities);

  return normalizedAuto(capabilities);
}

export function applyReasoningCapabilities(options: ApplyOptions): {
  body: JsonObject;
  model: string;
} {
  const suffix = parsedSuffix(options.model);
  const intent = suffix.intent ?? sourceIntent(options.source, options.sourceDialect);

  if (intent === undefined) return { body: options.body, model: suffix.model };

  const normalized = normalizedIntent(
    intent,
    options.capabilities,
    options.strict ?? options.sourceDialect === options.targetDialect,
  );

  return {
    body: applyReasoningIntent(options.body, options.targetDialect, normalized),
    model: suffix.model,
  };
}
