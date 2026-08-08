function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function anthropicWebSearchResults(input: unknown): unknown[] {
  if (!isRecord(input)) return [];

  const results = input['results'];

  return Array.isArray(results) ? results : [];
}
