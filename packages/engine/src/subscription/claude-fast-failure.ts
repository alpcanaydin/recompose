import type { JsonObject } from '../gateway-wire';

export type ClaudeFailureScope = 'request' | 'credential';

const FAST_BETA = 'fast-mode-2026-02-01';

export class ClaudeRequestScopedError extends Error {
  readonly scope = 'request';

  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Claude fast request failed', { cause });
    this.name = 'ClaudeRequestScopedError';
  }
}

export function claudeRequestUsesFastMode(body: JsonObject): boolean {
  if (body['speed'] === 'fast') return true;

  const betas = body['betas'];

  return Array.isArray(betas) && betas.includes(FAST_BETA);
}

export async function claudeFailureScope(
  status: number,
  response: Response,
  requestBody: JsonObject,
): Promise<ClaudeFailureScope> {
  if (claudeRequestUsesFastMode(requestBody)) return 'request';
  if (status !== 429) return 'credential';

  return (await isFastCreditRefusal(response)) ? 'request' : 'credential';
}

async function isFastCreditRefusal(response: Response): Promise<boolean> {
  const text = (
    await response
      .clone()
      .text()
      .catch(() => '')
  ).toLowerCase();

  return text.includes('fast mode') && text.includes('usage credits');
}
