import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

const contextManagement = {
  edits: [{ type: 'clear_thinking_20251015', keep: 'all' }],
} as const;

function thinkingTypeIn(body: JsonObject): unknown {
  const thinking = body['thinking'];

  return isJsonObject(thinking) ? thinking['type'] : undefined;
}

export function withClaudeContextManagement(body: JsonObject): JsonObject {
  if (body['context_management'] !== undefined || thinkingTypeIn(body) === 'disabled') {
    return body;
  }

  return { ...body, context_management: structuredClone(contextManagement) };
}
