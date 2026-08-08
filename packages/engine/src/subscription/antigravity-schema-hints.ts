type JsonObject = Record<string, unknown>;

export function mergedSchemaHint(existing: unknown, hint: string): string {
  if (typeof existing !== 'string' || existing === '') return hint;
  if (existing === hint || existing.includes(`(${hint})`)) return existing;

  return `${existing} (${hint})`;
}

export function addSchemaHint(schema: JsonObject, hint: string): void {
  schema['description'] = mergedSchemaHint(schema['description'], hint);
}
