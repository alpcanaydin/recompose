import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

const GEMINI_OUTPUT_LIMITS = new Map<string, number>([
  ['gemini-2.5-pro', 65_536],
  ['gemini-2.5-flash', 65_536],
  ['gemini-2.5-flash-lite', 65_536],
  ['gemini-3-pro-preview', 65_536],
  ['gemini-3.1-pro-preview', 65_536],
  ['gemini-3.1-flash-image-preview', 65_536],
  ['gemini-3-flash-preview', 65_536],
  ['gemini-3.1-flash-lite-preview', 65_536],
  ['gemini-3-pro-image-preview', 65_536],
  ['gemini-3.5-flash', 65_536],
  ['gemini-3.5-flash-lite', 65_536],
  ['gemini-3.6-flash', 65_536],
]);

export function cappedGeminiOutput(body: JsonObject, model: string): JsonObject {
  const generation = body['generationConfig'];
  const limit = GEMINI_OUTPUT_LIMITS.get(model);

  if (!isJsonObject(generation) || limit === undefined) return body;

  const requested = generation['maxOutputTokens'];

  if (typeof requested !== 'number' || requested <= limit) return body;

  return { ...body, generationConfig: { ...generation, maxOutputTokens: limit } };
}
