import { isJsonObject } from '../gateway-wire';
import { addSchemaHint, mergedSchemaHint } from './antigravity-schema-hints';
import {
  addAntigravityPlaceholder,
  removeGeminiPlaceholders,
} from './antigravity-schema-placeholders';
import { flattenedSchemaUnion } from './antigravity-schema-unions';

type JsonObject = Record<string, unknown>;

type CleanOptions = {
  addPlaceholder: boolean;
  flattenUnions: boolean;
  forceEnumStringType: boolean;
  removeGeminiMetadata: boolean;
};

const TOOL_OPTIONS: CleanOptions = {
  addPlaceholder: true,
  flattenUnions: true,
  forceEnumStringType: true,
  removeGeminiMetadata: false,
};

const GEMINI_OPTIONS: CleanOptions = {
  addPlaceholder: false,
  flattenUnions: true,
  forceEnumStringType: true,
  removeGeminiMetadata: true,
};

const RESPONSE_OPTIONS: CleanOptions = {
  addPlaceholder: false,
  flattenUnions: false,
  forceEnumStringType: false,
  removeGeminiMetadata: false,
};

const constraintNames = [
  'minLength',
  'maxLength',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'pattern',
  'minItems',
  'maxItems',
  'uniqueItems',
  'format',
  'default',
  'examples',
] as const;
const unsupportedNames = [
  '$schema',
  '$defs',
  'definitions',
  'const',
  '$ref',
  '$id',
  'additionalProperties',
  'propertyNames',
  'patternProperties',
  '$comment',
  'enumDescriptions',
  'enumTitles',
  'prefill',
  'deprecated',
] as const;

function refReplacement(schema: JsonObject): JsonObject | null {
  const reference = schema['$ref'];

  if (typeof reference !== 'string') return null;

  const name = reference.split('/').at(-1) ?? reference;

  return { type: 'object', description: mergedSchemaHint(schema['description'], `See: ${name}`) };
}

function convertConst(schema: JsonObject): void {
  if (schema['const'] !== undefined && schema['enum'] === undefined) {
    schema['enum'] = [schema['const']];
  }
}

function convertEnum(schema: JsonObject, options: CleanOptions): void {
  if (!Array.isArray(schema['enum'])) return;

  const values = schema['enum'].map(String);

  schema['enum'] = values;
  if (options.forceEnumStringType) schema['type'] = 'string';
  if (values.length > 1 && values.length <= 10)
    addSchemaHint(schema, `Allowed: ${values.join(', ')}`);
}

function scalarText(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function moveConstraints(schema: JsonObject): void {
  if (schema['additionalProperties'] === false)
    addSchemaHint(schema, 'No extra properties allowed');

  for (const name of constraintNames) {
    const value = scalarText(schema[name]);

    if (value !== undefined) addSchemaHint(schema, `${name}: ${value}`);
  }
}

function mergedProperties(schema: JsonObject, item: JsonObject): void {
  if (!isJsonObject(item['properties'])) return;

  const properties = isJsonObject(schema['properties']) ? schema['properties'] : {};

  Object.assign(properties, item['properties']);
  schema['properties'] = properties;
}

function mergedRequired(schema: JsonObject, item: JsonObject): void {
  if (!Array.isArray(item['required'])) return;

  const required = new Set(
    Array.isArray(schema['required']) ? schema['required'].filter(isString) : [],
  );

  for (const name of item['required'].filter(isString)) required.add(name);
  if (required.size > 0) schema['required'] = [...required];
}

function mergeAllOf(schema: JsonObject): void {
  const allOf = schema['allOf'];

  if (!Array.isArray(allOf)) return;

  for (const item of allOf) {
    if (!isJsonObject(item)) continue;

    mergedProperties(schema, item);
    mergedRequired(schema, item);
  }

  delete schema['allOf'];
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function cleanedPropertyEntries(
  properties: JsonObject,
  options: CleanOptions,
): { entries: JsonObject; nullable: Set<string> } {
  const entries: JsonObject = {};
  const nullable = new Set<string>();

  for (const [name, value] of Object.entries(properties)) {
    if (!isJsonObject(value)) continue;
    if (Array.isArray(value['type']) && value['type'].includes('null')) nullable.add(name);

    entries[name] = cleanNode(value, options, false);
  }

  return { entries, nullable };
}

function cleanRequired(schema: JsonObject, properties: JsonObject, nullable: Set<string>): void {
  if (!Array.isArray(schema['required'])) return;

  const required = schema['required'].filter(
    (name): name is string => typeof name === 'string' && name in properties && !nullable.has(name),
  );

  if (required.length === 0) delete schema['required'];
  else schema['required'] = required;
}

function flattenType(schema: JsonObject): boolean {
  const types = schema['type'];

  if (!Array.isArray(types)) return false;

  const names = types.filter(isString);
  const nonNull = names.filter((name) => name !== 'null');

  schema['type'] = nonNull[0] ?? 'string';
  if (nonNull.length > 1) addSchemaHint(schema, `Accepts: ${nonNull.join(' | ')}`);
  if (names.includes('null')) addSchemaHint(schema, '(nullable)');

  return names.includes('null');
}

function cleanProperties(schema: JsonObject, options: CleanOptions): void {
  const properties = schema['properties'];

  if (!isJsonObject(properties)) return;

  const cleaned = cleanedPropertyEntries(properties, options);

  schema['properties'] = cleaned.entries;
  cleanRequired(schema, cleaned.entries, cleaned.nullable);
}

function cleanUnionChildren(schema: JsonObject, options: CleanOptions): void {
  for (const key of ['anyOf', 'oneOf']) {
    const raw = schema[key];
    const values: unknown[] | null = Array.isArray(raw) ? raw.map((value: unknown) => value) : null;

    if (values === null) continue;
    schema[key] = values.map((value) =>
      isJsonObject(value) ? cleanNode(value, options, false) : value,
    );
  }
}

function cleanChildren(schema: JsonObject, options: CleanOptions): void {
  cleanProperties(schema, options);
  cleanUnionChildren(schema, options);

  if (isJsonObject(schema['items'])) schema['items'] = cleanNode(schema['items'], options, false);
}

function removeUnsupported(schema: JsonObject, options: CleanOptions): void {
  for (const name of [...constraintNames, ...unsupportedNames]) delete schema[name];

  for (const name of Object.keys(schema)) {
    if (name.startsWith('x-')) delete schema[name];
  }

  if (options.removeGeminiMetadata) {
    delete schema['nullable'];
    delete schema['title'];
    removeGeminiPlaceholders(schema);
  }
}

function cleanNode(raw: JsonObject, options: CleanOptions, topLevel: boolean): JsonObject {
  let schema = structuredClone(raw);

  schema = refReplacement(schema) ?? schema;
  convertConst(schema);
  convertEnum(schema, options);
  moveConstraints(schema);
  mergeAllOf(schema);
  if (options.flattenUnions) schema = flattenedSchemaUnion(schema) ?? schema;
  flattenType(schema);
  cleanChildren(schema, options);
  removeUnsupported(schema, options);
  if (options.addPlaceholder) addAntigravityPlaceholder(schema, topLevel);

  return schema;
}

export function cleanAntigravityToolSchema(schema: JsonObject): JsonObject {
  return cleanNode(schema, TOOL_OPTIONS, true);
}

export function cleanNestedAntigravityToolSchema(schema: JsonObject): JsonObject {
  return cleanNode(schema, TOOL_OPTIONS, false);
}

export function cleanGeminiToolSchema(schema: JsonObject): JsonObject {
  return cleanNode(schema, GEMINI_OPTIONS, true);
}

export function cleanAntigravityResponseSchema(schema: JsonObject): JsonObject {
  return cleanNode(schema, RESPONSE_OPTIONS, true);
}
