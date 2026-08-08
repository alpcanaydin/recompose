import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

const DECLARATION_KEYS = ['functionDeclarations', 'function_declarations'] as const;

function declarationName(value: JsonObject): string | undefined {
  const name = value['name'];

  if (typeof name === 'string') return name;
  if (name === undefined) return undefined;

  const primitive = primitiveName(name);

  return primitive ?? JSON.stringify(name);
}

function primitiveName(value: unknown): string | undefined {
  return typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint'
    ? String(value)
    : undefined;
}

function uniqueDeclarations(value: unknown, seen: Set<string>): unknown[] | null {
  if (!Array.isArray(value)) return null;

  const declarations: unknown[] = value;

  return declarations.flatMap((declaration) => {
    if (!isJsonObject(declaration)) return [];

    const name = declarationName(declaration);

    if (name === undefined || seen.has(name)) return [];

    seen.add(name);

    return [{ ...declaration, name }];
  });
}

function normalizedTool(value: unknown, seen: Set<string>): JsonObject | null {
  if (!isJsonObject(value)) return null;
  if (isJsonObject(value['googleSearch'])) return value;

  return normalizedFunctionTool(value, seen);
}

function normalizedFunctionTool(value: JsonObject, seen: Set<string>): JsonObject | null {
  const tool = { ...value };

  for (const key of DECLARATION_KEYS) {
    const declarations = uniqueDeclarations(tool[key], seen);

    if (declarations !== null) tool[key] = declarations;
  }

  return DECLARATION_KEYS.some((key) => Array.isArray(tool[key]) && tool[key].length > 0)
    ? tool
    : null;
}

export function normalizeAntigravityTools(request: JsonObject): void {
  const tools = request['tools'];

  if (!Array.isArray(tools)) return;

  const seen = new Set<string>();
  const entries: unknown[] = tools;

  request['tools'] = entries.flatMap((tool) => {
    const normalized = normalizedTool(tool, seen);

    return normalized === null ? [] : [normalized];
  });
}
