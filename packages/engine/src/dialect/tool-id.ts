import { createHash } from 'node:crypto';

const RESPONSES_IDENTIFIER_LIMIT = 64;

export function sanitizeToolId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_');
}

export function responsesIdentifier(value: string): string {
  if (value.length <= RESPONSES_IDENTIFIER_LIMIT) return value;

  const hash = createHash('sha256').update(value).digest('hex').slice(0, 8);

  return `${value.slice(0, RESPONSES_IDENTIFIER_LIMIT - hash.length - 1)}_${hash}`;
}

export function firstToolIdCollision(originalIds: Iterable<string>): string | undefined {
  const originalBySanitized = new Map<string, string>();

  for (const original of originalIds) {
    const sanitized = sanitizeToolId(original);
    const seen = originalBySanitized.get(sanitized);

    if (seen === undefined) {
      originalBySanitized.set(sanitized, original);

      continue;
    }

    if (seen !== original) {
      return sanitized;
    }
  }

  return undefined;
}
