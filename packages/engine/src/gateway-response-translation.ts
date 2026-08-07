import type { AnthropicResponse } from './dialect/anthropic-wire';
import type { ChatCompletionsResponse } from './dialect/chat-completions-wire';
import type { InteractionsResponse } from './dialect/interactions-wire';
import type { Crossing, JsonObject, ProviderDialect } from './gateway-wire';

import { translateResponse } from './dialect/dispatcher';
import { isGeminiResponse, translateResponseFromGemini } from './dialect/gemini-bridge';
import { isResponsesAnswer } from './dialect/responses-answer-shape';
import { isJsonObject } from './gateway-wire';

function isChatAnswer(value: JsonObject): value is JsonObject & ChatCompletionsResponse {
  const choices = value['choices'];

  return (
    Array.isArray(choices) &&
    choices.every((choice) => isJsonObject(choice) && isJsonObject(choice['message']))
  );
}

export function isAnthropicAnswer(value: JsonObject): value is JsonObject & AnthropicResponse {
  return hasAnthropicEnvelope(value) && hasAnthropicPayload(value);
}

function hasAnthropicEnvelope(value: JsonObject): boolean {
  return (
    typeof value['id'] === 'string' && value['type'] === 'message' && value['role'] === 'assistant'
  );
}

function hasAnthropicPayload(value: JsonObject): boolean {
  const stopReason = value['stop_reason'];

  return Array.isArray(value['content']) && (typeof stopReason === 'string' || stopReason === null);
}

function isInteractionsAnswer(value: JsonObject): value is JsonObject & InteractionsResponse {
  return typeof value['id'] === 'string' && Array.isArray(value['steps']);
}

export function translatedResponse(from: ProviderDialect, crossing: Crossing, answer: JsonObject) {
  return from === 'gemini'
    ? translatedGeminiResponse(crossing, answer)
    : translatedNonGeminiResponse(from, crossing, answer);
}

function translatedGeminiResponse(crossing: Crossing, answer: JsonObject) {
  return isGeminiResponse(answer)
    ? translateResponseFromGemini(crossing.dialect, answer, crossing.geminiToolNames)
    : null;
}

function translatedNonGeminiResponse(
  from: Exclude<ProviderDialect, 'gemini'>,
  crossing: Crossing,
  answer: JsonObject,
) {
  if (from === 'chat-completions') return translatedChat(crossing, answer);
  if (from === 'anthropic') return translatedAnthropic(crossing, answer);
  if (from === 'interactions') return translatedInteractions(crossing, answer);

  return translatedResponses(crossing, answer);
}

function translatedChat(crossing: Crossing, answer: JsonObject) {
  return isChatAnswer(answer)
    ? translateResponse('chat-completions', crossing.dialect, answer)
    : null;
}

function translatedAnthropic(crossing: Crossing, answer: JsonObject) {
  return isAnthropicAnswer(answer)
    ? translateResponse('anthropic', crossing.dialect, answer)
    : null;
}

function translatedInteractions(crossing: Crossing, answer: JsonObject) {
  return isInteractionsAnswer(answer)
    ? translateResponse('interactions', crossing.dialect, answer)
    : null;
}

function translatedResponses(crossing: Crossing, answer: JsonObject) {
  return isResponsesAnswer(answer)
    ? translateResponse('responses', crossing.dialect, answer)
    : null;
}
