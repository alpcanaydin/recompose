import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

export function activeClaudeThinking(body: JsonObject): boolean {
  const thinking = body['thinking'];

  if (!isJsonObject(thinking)) return false;
  if (thinking['type'] === 'adaptive') return true;
  if (thinking['type'] !== 'enabled') return false;

  return activeClaudeBudget(thinking['budget_tokens']);
}

function activeClaudeBudget(value: unknown): boolean {
  if (value === undefined || value === -1) return true;

  return typeof value === 'number' && value > 0;
}

export function enabledClaudeThinking(model: string | undefined): JsonObject {
  return /claude-(?:fable|mythos|opus|sonnet)-5/iu.test(model ?? '')
    ? { type: 'adaptive' }
    : { type: 'enabled', budget_tokens: 1024 };
}
