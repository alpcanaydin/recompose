import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import {
  cleanAntigravityResponseSchema,
  cleanGeminiToolSchema,
  cleanNestedAntigravityToolSchema,
} from './antigravity-schema';

const declarationKeys = ['functionDeclarations', 'function_declarations'] as const;
const schemaKeys = [
  'parameters',
  'parametersJsonSchema',
  'parameters_json_schema',
  'response',
  'responseJsonSchema',
  'response_json_schema',
] as const;
const responseSchemaKeys = [
  'responseSchema',
  'responseJsonSchema',
  'response_schema',
  'response_json_schema',
] as const;

function cleanDeclaration(declaration: JsonObject, antigravity: boolean): void {
  if (isJsonObject(declaration['parametersJsonSchema'])) {
    declaration['parameters'] = declaration['parametersJsonSchema'];
    delete declaration['parametersJsonSchema'];
  }

  for (const key of schemaKeys) {
    const schema = declaration[key];

    if (isJsonObject(schema)) {
      declaration[key] = antigravity
        ? cleanNestedAntigravityToolSchema(schema)
        : cleanGeminiToolSchema(schema);
    }
  }
}

function cleanDeclarations(value: unknown, antigravity: boolean): void {
  if (!Array.isArray(value)) return;

  for (const declaration of value) {
    if (isJsonObject(declaration)) cleanDeclaration(declaration, antigravity);
  }
}

function cleanTool(value: unknown, antigravity: boolean): void {
  if (!isJsonObject(value)) return;

  for (const key of declarationKeys) cleanDeclarations(value[key], antigravity);
}

function cleanTools(request: JsonObject, antigravity: boolean): void {
  const tools = request['tools'];

  if (!Array.isArray(tools)) return;

  for (const tool of tools) cleanTool(tool, antigravity);
}

function cleanResponseSchemas(request: JsonObject): void {
  for (const configKey of ['generationConfig', 'generation_config']) {
    const config = request[configKey];

    if (!isJsonObject(config)) continue;

    for (const key of responseSchemaKeys) {
      if (isJsonObject(config[key])) {
        config[key] = cleanAntigravityResponseSchema(config[key]);
      }
    }
  }
}

export function cleanAntigravityRequestSchemas(request: JsonObject, model: string): void {
  const privateSchema =
    model.includes('claude') || model.includes('gemini-3-pro') || model.includes('gemini-3.1-pro');

  cleanTools(request, privateSchema);
  cleanResponseSchemas(request);
}
