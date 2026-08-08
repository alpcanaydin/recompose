import type { JsonObject } from '../gateway-wire';
import type { ReasoningDialect, ReasoningIntent } from './reasoning-types';

import { isJsonObject } from '../gateway-wire';

function withInteractionLevel(body: JsonObject, level: string): JsonObject {
  const config = isJsonObject(body['generation_config']) ? body['generation_config'] : {};

  return { ...body, generation_config: { ...config, thinking_level: level } };
}

function withGeminiThinking(body: JsonObject, field: string, value: string | number): JsonObject {
  const generation = isJsonObject(body['generationConfig']) ? body['generationConfig'] : {};
  const thinking = isJsonObject(generation['thinkingConfig']) ? generation['thinkingConfig'] : {};

  return {
    ...body,
    generationConfig: { ...generation, thinkingConfig: { ...thinking, [field]: value } },
  };
}

function withGeminiLevel(body: JsonObject, level: string): JsonObject {
  return withGeminiThinking(body, 'thinkingLevel', level);
}

function withAnthropicLevel(body: JsonObject, level: string): JsonObject {
  if (level === 'none') return { ...body, thinking: { type: 'disabled' } };

  const output = isJsonObject(body['output_config']) ? body['output_config'] : {};

  return { ...body, output_config: { ...output, effort: level } };
}

function withNonAnthropicLevel(
  body: JsonObject,
  dialect: Exclude<ReasoningDialect, 'anthropic'>,
  level: string,
): JsonObject {
  if (dialect === 'chat-completions') return { ...body, reasoning_effort: level };
  if (dialect === 'interactions') return withInteractionLevel(body, level);
  if (dialect === 'gemini') return withGeminiLevel(body, level);

  const reasoning = isJsonObject(body['reasoning']) ? body['reasoning'] : {};

  return { ...body, reasoning: { ...reasoning, effort: level } };
}

function withLevel(body: JsonObject, dialect: ReasoningDialect, level: string): JsonObject {
  return dialect === 'anthropic'
    ? withAnthropicLevel(body, level)
    : withNonAnthropicLevel(body, dialect, level);
}

function withInteractionBudget(body: JsonObject, budget: number): JsonObject {
  const config = isJsonObject(body['generation_config']) ? body['generation_config'] : {};

  return { ...body, generation_config: { ...config, thinking_budget: budget } };
}

function withGeminiBudget(body: JsonObject, budget: number): JsonObject {
  return withGeminiThinking(body, 'thinkingBudget', budget);
}

function withBudget(body: JsonObject, dialect: ReasoningDialect, budget: number): JsonObject {
  if (dialect === 'interactions') return withInteractionBudget(body, budget);
  if (dialect === 'gemini') return withGeminiBudget(body, budget);
  if (dialect !== 'anthropic') return body;

  const thinking = isJsonObject(body['thinking']) ? body['thinking'] : {};

  return { ...body, thinking: { ...thinking, type: 'enabled', budget_tokens: budget } };
}

export function applyReasoningIntent(
  body: JsonObject,
  dialect: ReasoningDialect,
  intent: ReasoningIntent,
): JsonObject {
  if (intent.kind === 'level') return withLevel(body, dialect, intent.level);
  if (intent.kind === 'budget') return withBudget(body, dialect, intent.budget);
  if (dialect === 'anthropic') return { ...body, thinking: { type: 'adaptive' } };

  return withLevel(body, dialect, 'auto');
}
