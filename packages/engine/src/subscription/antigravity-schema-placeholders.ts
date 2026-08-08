import { isJsonObject } from '../gateway-wire';

type JsonObject = Record<string, unknown>;

const DESCRIPTION = 'Brief explanation of why you are calling this tool';

function removeRequiredName(schema: JsonObject, name: string): void {
  if (!Array.isArray(schema['required'])) return;

  const remaining = schema['required'].filter((value) => value !== name);

  if (remaining.length === 0) delete schema['required'];
  else schema['required'] = remaining;
}

function removeUnderscore(schema: JsonObject, properties: JsonObject): void {
  if (properties['_'] === undefined) return;

  delete properties['_'];
  removeRequiredName(schema, '_');
}

function isPlaceholderReason(properties: JsonObject): boolean {
  const reason = properties['reason'];

  return (
    Object.keys(properties).length === 1 &&
    isJsonObject(reason) &&
    reason['description'] === DESCRIPTION
  );
}

export function removeGeminiPlaceholders(schema: JsonObject): void {
  const properties = schema['properties'];

  if (!isJsonObject(properties)) return;

  removeUnderscore(schema, properties);

  if (isPlaceholderReason(properties)) {
    delete properties['reason'];
    removeRequiredName(schema, 'reason');
  }
}

function emptyObjectPlaceholder(schema: JsonObject, properties: JsonObject): boolean {
  if (Object.keys(properties).length !== 0) return false;

  schema['properties'] = { reason: { type: 'string', description: DESCRIPTION } };
  schema['required'] = ['reason'];

  return true;
}

function optionalObjectPlaceholder(schema: JsonObject, properties: JsonObject): void {
  const required = Array.isArray(schema['required']) ? schema['required'] : [];

  if (required.length > 0) return;

  properties['_'] ??= { type: 'boolean' };
  schema['required'] = ['_'];
}

export function addAntigravityPlaceholder(schema: JsonObject, topLevel: boolean): void {
  if (schema['type'] !== 'object') return;

  const properties = isJsonObject(schema['properties']) ? schema['properties'] : {};

  if (emptyObjectPlaceholder(schema, properties)) return;
  if (!topLevel) optionalObjectPlaceholder(schema, properties);
}
