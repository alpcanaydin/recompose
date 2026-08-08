import { isJsonObject } from '../gateway-wire';
import { addSchemaHint, mergedSchemaHint } from './antigravity-schema-hints';

type JsonObject = Record<string, unknown>;

function unionScore(value: unknown): number {
  if (!isJsonObject(value)) return 0;

  const score = new Map<unknown, number>([
    ['object', 3],
    ['array', 2],
    ['null', 0],
    [undefined, 0],
  ]).get(value['type']);

  if (value['properties'] !== undefined) return 3;
  if (value['items'] !== undefined) return 2;

  return score ?? 1;
}

function bestUnionValue(values: unknown[]): JsonObject | null {
  const objects = values.filter(isJsonObject);

  return objects.sort((left, right) => unionScore(right) - unionScore(left))[0] ?? null;
}

function unionTypes(values: unknown[]): string[] {
  return values.flatMap((value) =>
    isJsonObject(value) && typeof value['type'] === 'string' ? [value['type']] : [],
  );
}

function unionValues(schema: JsonObject): unknown[] {
  if (Array.isArray(schema['anyOf'])) return schema['anyOf'];
  if (Array.isArray(schema['oneOf'])) return schema['oneOf'];

  return [];
}

export function flattenedSchemaUnion(schema: JsonObject): JsonObject | null {
  const values = unionValues(schema);

  if (values.length === 0) return null;

  const selected = bestUnionValue(values);

  if (selected === null) return null;

  const types = unionTypes(values);
  const replacement = structuredClone(selected);
  const description = schema['description'];

  if (typeof description === 'string') {
    replacement['description'] = mergedSchemaHint(replacement['description'], description);
  }

  if (new Set(types).size > 1) addSchemaHint(replacement, `Accepts: ${types.join(' | ')}`);

  return replacement;
}
