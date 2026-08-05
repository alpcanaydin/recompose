export function sanitizeToolId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_');
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
