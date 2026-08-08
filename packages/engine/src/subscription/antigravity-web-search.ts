import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

function isGoogleSearchTool(value: unknown): boolean {
  return isJsonObject(value) && isJsonObject(value['googleSearch']);
}

export function supportsAntigravityWebSearch(model: string): boolean {
  return model === 'gemini-3.1-flash-lite';
}

export function hasAntigravityWebSearch(request: JsonObject): boolean {
  const tools = request['tools'];

  return Array.isArray(tools) && tools.some(isGoogleSearchTool);
}

export function removeUnsupportedAntigravityWebSearch(request: JsonObject, model: string): void {
  if (supportsAntigravityWebSearch(model)) return;

  const tools = request['tools'];

  if (!Array.isArray(tools)) return;

  request['tools'] = tools.filter((tool) => !isGoogleSearchTool(tool));
}
