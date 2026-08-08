import type { GeminiRequest } from './dialect/gemini-wire';

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function speaksGemini(body: JsonObject): body is JsonObject & GeminiRequest {
  return Array.isArray(body['contents']);
}

export function geminiPayload(body: JsonObject): GeminiRequest | null {
  const normalized = normalizedGeminiBody(body);

  return speaksGemini(normalized) ? normalized : null;
}

function normalizedGeminiBody(body: JsonObject): JsonObject {
  return {
    ...body,
    contents: normalizedContents(body['contents']),
    ...normalizedTools(body),
    ...normalizedToolConfig(body),
  };
}

function normalizedContents(value: unknown): unknown {
  if (!Array.isArray(value)) return value;

  const contents: unknown[] = value;

  return contents.map((content) => {
    if (!isJsonObject(content) || !Array.isArray(content['parts'])) return content;

    const parts: unknown[] = content['parts'];

    return { ...content, parts: parts.map(normalizedPart) };
  });
}

function normalizedPart(value: unknown): unknown {
  if (!isJsonObject(value)) return value;

  const call = value['functionCall'] ?? value['function_call'];
  const response = value['functionResponse'] ?? value['function_response'];
  const clean = withoutFunctionAliases(value);

  return { ...clean, ...functionAliasFields(call, response) };
}

function withoutFunctionAliases(value: JsonObject): JsonObject {
  const clean = { ...value };

  delete clean['function_call'];
  delete clean['function_response'];

  return clean;
}

function functionAliasFields(call: unknown, response: unknown): JsonObject {
  return {
    ...(call === undefined ? {} : { functionCall: call }),
    ...(response === undefined ? {} : { functionResponse: response }),
  };
}

function normalizedTools(body: JsonObject): JsonObject {
  const tools = body['tools'];

  if (!Array.isArray(tools)) return {};

  const entries: unknown[] = tools;

  return {
    tools: entries.map((tool) => {
      if (!isJsonObject(tool)) return tool;

      const declarations = tool['functionDeclarations'] ?? tool['function_declarations'];
      const clean = { ...tool };

      delete clean['function_declarations'];

      return {
        ...clean,
        ...(declarations === undefined ? {} : { functionDeclarations: declarations }),
      };
    }),
  };
}

function normalizedToolConfig(body: JsonObject): JsonObject {
  const raw = body['toolConfig'] ?? body['tool_config'];

  if (!isJsonObject(raw)) return {};

  const calling = raw['functionCallingConfig'] ?? raw['function_calling_config'];

  return isJsonObject(calling)
    ? { toolConfig: { functionCallingConfig: normalizedCallingConfig(calling) } }
    : { toolConfig: raw };
}

function normalizedCallingConfig(config: JsonObject): JsonObject {
  const names = config['allowedFunctionNames'] ?? config['allowed_function_names'];
  const clean = { ...config };

  delete clean['allowed_function_names'];

  return { ...clean, ...(names === undefined ? {} : { allowedFunctionNames: names }) };
}
