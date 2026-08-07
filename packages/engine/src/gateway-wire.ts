import type { Context } from 'hono';

import type { AnthropicMessage } from './dialect/anthropic-wire';
import type { ChatMessage } from './dialect/chat-completions-wire';
import type { RequestOf } from './dialect/dispatcher';
import type { TranslationRefusal } from './refusals';

import { duplicateJsonKey } from './json-duplicates';
import { renderRefusal } from './refusals';

export type ProxyDialect = 'anthropic' | 'chat-completions' | 'responses';
export type ProviderDialect = ProxyDialect | 'gemini';

export type JsonObject = Record<string, unknown>;

export class InvalidJsonBodyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidJsonBodyError';
  }
}

export type Crossing = {
  dialect: ProxyDialect;
  raw: JsonObject;
  gatewayName: string;
  virtualModel: string;
  providerModel: string;
  sessionId?: string | undefined;
  replayScopeId?: string | undefined;
  responsesLite?: boolean | undefined;
  anthropicBeta?: string | undefined;
  xaiNamespaceTools?: Record<string, { namespace: string; name: string }> | undefined;
};

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parsedJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function readJsonBody(c: Context): Promise<JsonObject> {
  const text = await c.req.text();
  const body = parsedJson(text);
  const duplicate = duplicateJsonKey(text);

  if (!isJsonObject(body)) {
    throw new InvalidJsonBodyError('The request body must be a JSON object.');
  }

  if (duplicate !== undefined) {
    throw new InvalidJsonBodyError(`The request body repeats the JSON key "${duplicate}".`);
  }

  return body;
}

export function virtualNameOf(body: JsonObject): string {
  const model = body['model'];

  return typeof model === 'string' ? model : '';
}

export function wantsStream(body: JsonObject): boolean {
  return body['stream'] === true;
}

const wireBlockKinds = new Set([
  'text',
  'thinking',
  'redacted_thinking',
  'image',
  'document',
  'tool_use',
  'tool_result',
]);

const toolResultPartKinds = new Set([
  'text',
  'image',
  'search_result',
  'document',
  'tool_reference',
]);

function isToolResultPart(value: unknown): boolean {
  return (
    isJsonObject(value) &&
    typeof value['type'] === 'string' &&
    toolResultPartKinds.has(value['type'])
  );
}

function readsToolResultContent(content: unknown): boolean {
  return (
    content === undefined ||
    typeof content === 'string' ||
    (Array.isArray(content) && content.every(isToolResultPart))
  );
}

function readsDocument(value: JsonObject): boolean {
  const source = value['source'];

  return (
    isJsonObject(source) &&
    source['type'] === 'base64' &&
    typeof source['media_type'] === 'string' &&
    typeof source['data'] === 'string'
  );
}

function readsWireBlock(value: JsonObject): boolean {
  if (value['type'] === 'tool_result') {
    return readsToolResultContent(value['content']);
  }

  return value['type'] !== 'document' || readsDocument(value);
}

function isWireBlock(value: unknown): boolean {
  return (
    isJsonObject(value) &&
    typeof value['type'] === 'string' &&
    wireBlockKinds.has(value['type']) &&
    readsWireBlock(value)
  );
}

function isWireContent(content: unknown): boolean {
  return typeof content === 'string' || (Array.isArray(content) && content.every(isWireBlock));
}

function isWireMessage(value: unknown): value is AnthropicMessage {
  if (!isJsonObject(value)) {
    return false;
  }

  const role = value['role'];

  return (role === 'user' || role === 'assistant') && isWireContent(value['content']);
}

function speaksAnthropicWire(body: JsonObject): body is JsonObject & RequestOf['anthropic'] {
  const messages = body['messages'];

  return Array.isArray(messages) && messages.every(isWireMessage);
}

const chatRoles = new Set(['system', 'developer', 'user', 'assistant', 'tool']);

function isChatMessage(value: unknown): value is ChatMessage {
  return isJsonObject(value) && typeof value['role'] === 'string' && chatRoles.has(value['role']);
}

function speaksChatCompletions(
  body: JsonObject,
): body is JsonObject & RequestOf['chat-completions'] {
  const messages = body['messages'];

  return Array.isArray(messages) && messages.every(isChatMessage);
}

function speaksResponses(body: JsonObject): body is JsonObject & RequestOf['responses'] {
  const input = body['input'];

  return (
    Array.isArray(input) &&
    input.every((item) => isJsonObject(item) && typeof item['type'] === 'string')
  );
}

export function ingressPayload(
  dialect: 'anthropic',
  body: JsonObject,
): RequestOf['anthropic'] | null;
export function ingressPayload(
  dialect: 'chat-completions',
  body: JsonObject,
): RequestOf['chat-completions'] | null;
export function ingressPayload(
  dialect: 'responses',
  body: JsonObject,
): RequestOf['responses'] | null;
export function ingressPayload(
  dialect: ProxyDialect,
  body: JsonObject,
): RequestOf[ProxyDialect] | null;

export function ingressPayload(
  dialect: ProxyDialect,
  body: JsonObject,
): RequestOf[ProxyDialect] | null {
  if (dialect === 'anthropic') {
    return anthropicPayload(body);
  }

  if (dialect === 'responses') {
    return responsesPayload(body);
  }

  return chatPayload(body);
}

function anthropicPayload(body: JsonObject): RequestOf['anthropic'] | null {
  return speaksAnthropicWire(body) ? body : null;
}

function responsesPayload(body: JsonObject): RequestOf['responses'] | null {
  return speaksResponses(body) ? body : null;
}

function chatPayload(body: JsonObject): RequestOf['chat-completions'] | null {
  return speaksChatCompletions(body) ? body : null;
}

export function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export function refusalResponse(dialect: ProxyDialect, refusal: TranslationRefusal): Response {
  const rendered = renderRefusal(dialect, refusal);

  return jsonResponse(rendered.body, rendered.status);
}
