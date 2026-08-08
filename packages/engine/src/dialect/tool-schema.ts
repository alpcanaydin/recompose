import type { HubJsonObject, HubToolSchema } from './hub';

const coreFields = new Set(['type', 'properties', 'required']);

function isJsonObject(value: unknown): value is HubJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredFrom(value: unknown): readonly string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
}

function schemaMetadata(schema: HubJsonObject): HubJsonObject {
  return Object.fromEntries(Object.entries(schema).filter(([key]) => !coreFields.has(key)));
}

function normalizedSchemaValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizedSchemaValue);
  if (!isJsonObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      key === 'type' ? normalizedType(nested) : normalizedSchemaValue(nested),
    ]),
  );
}

function normalizedType(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : String(value);
}

function normalizedSchema(schema: HubJsonObject): HubJsonObject {
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      key === 'type' ? normalizedType(value) : normalizedSchemaValue(value),
    ]),
  );
}

function normalizedTypeValue(value: unknown): boolean {
  return typeof value === 'string' && value === value.toLowerCase();
}

function schemaTypesAreNormalized(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(schemaTypesAreNormalized);
  if (!isJsonObject(value)) return true;

  return Object.entries(value).every(normalizedSchemaEntry);
}

function normalizedSchemaEntry([key, value]: [string, unknown]): boolean {
  return key === 'type' ? normalizedTypeValue(value) : schemaTypesAreNormalized(value);
}

function providerSchemaIsCanonical(schema: HubToolSchema): boolean {
  return (
    schema['$schema'] === undefined &&
    schema['additionalProperties'] === false &&
    schemaTypesAreNormalized(schema)
  );
}

export function hubToolSchemaFrom(schema: HubJsonObject | undefined): HubToolSchema {
  const source = schema ?? {};
  const properties = isJsonObject(source['properties']) ? source['properties'] : {};
  const required = requiredFrom(source['required']);

  return {
    ...schemaMetadata(source),
    type: 'object',
    properties,
    ...(required === undefined ? {} : { required }),
  };
}

export function strictProviderToolSchema(schema: HubToolSchema): HubToolSchema {
  if (providerSchemaIsCanonical(schema)) return schema;

  const source = normalizedSchema(schema);

  const metadata = Object.fromEntries(
    Object.entries(source).filter(
      ([key]) =>
        key !== '$schema' &&
        key !== 'title' &&
        key !== 'type' &&
        key !== 'properties' &&
        key !== 'required',
    ),
  );
  const properties = isJsonObject(source['properties']) ? source['properties'] : {};
  const required = requiredFrom(source['required'])?.filter((name) => name in properties);

  return {
    ...metadata,
    type: 'object',
    properties,
    ...(required === undefined ? {} : { required }),
    additionalProperties: false,
  };
}

export function anthropicToolSchema(schema: HubToolSchema): HubToolSchema {
  const source = normalizedSchema(schema);
  const additional = source['additionalProperties'];
  const declaredSchema = source['$schema'];

  return {
    ...source,
    type: 'object',
    properties: isJsonObject(source['properties']) ? source['properties'] : {},
    ...anthropicAdditionalProperties(additional),
    ...anthropicSchemaDeclaration(declaredSchema),
  };
}

export function chatToolSchema(schema: HubToolSchema): HubToolSchema {
  return completedObjectSchema(schema);
}

function completedObjectSchema(schema: HubToolSchema): HubToolSchema {
  const completed = completedSchemaValue(schema);

  return isJsonObject(completed)
    ? {
        ...completed,
        type: 'object',
        properties: isJsonObject(completed['properties']) ? completed['properties'] : {},
      }
    : { type: 'object', properties: {} };
}

function completedSchemaValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(completedSchemaValue);
  if (!isJsonObject(value)) return value;

  const completed = Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, completedSchemaValue(nested)]),
  );

  return completed['type'] === 'object' && !isJsonObject(completed['properties'])
    ? { ...completed, properties: {} }
    : completed;
}

function anthropicAdditionalProperties(value: unknown): HubJsonObject {
  if (value === undefined) return {};

  return { additionalProperties: typeof value === 'boolean' ? value : false };
}

function anthropicSchemaDeclaration(value: unknown): HubJsonObject {
  if (value === undefined) return {};

  return {
    $schema: typeof value === 'string' ? value : 'http://json-schema.org/draft-07/schema#',
  };
}

export function strictHubToolSchemaFrom(schema: HubJsonObject): HubToolSchema {
  if (schema['anyOf'] !== undefined || schema['oneOf'] !== undefined) {
    return {
      type: 'object',
      properties: isJsonObject(schema['properties']) ? schema['properties'] : {},
      additionalProperties: false,
    };
  }

  return strictProviderToolSchema(hubToolSchemaFrom(schema));
}
