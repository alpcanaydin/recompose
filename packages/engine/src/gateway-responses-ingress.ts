import type { RequestOf } from './dialect/dispatcher';

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function speaksResponses(body: JsonObject): body is JsonObject & RequestOf['responses'] {
  const input = body['input'];

  return (
    Array.isArray(input) &&
    input.every((item) => isJsonObject(item) && typeof item['type'] === 'string')
  );
}

export function responsesIngressPayload(body: JsonObject): RequestOf['responses'] | null {
  const input = body['input'];
  const normalized =
    typeof input === 'string'
      ? { ...body, input: [{ type: 'message', role: 'user', content: input }] }
      : body;

  return speaksResponses(normalized) ? normalized : null;
}
