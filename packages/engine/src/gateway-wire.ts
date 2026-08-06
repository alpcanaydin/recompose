import type { Context } from 'hono';

import type { AnthropicMessage } from './dialect/anthropic-wire';
import type { ChatMessage } from './dialect/chat-completions-wire';
import type { RequestOf } from './dialect/dispatcher';
import type { TranslationRefusal } from './refusals';

import { renderRefusal } from './refusals';

export type ProxyDialect = 'anthropic' | 'chat-completions' | 'responses';

export type JsonObject = Record<string, unknown>;

export type Crossing = {
  dialect: ProxyDialect;
  raw: JsonObject;
  gatewayName: string;
  virtualModel: string;
  providerModel: string;
  sessionId?: string | undefined;
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
  const body: unknown = await c.req.json<unknown>().catch(() => null);

  return isJsonObject(body) ? body : {};
}

export function virtualNameOf(body: JsonObject): string {
  const model = body['model'];

  return typeof model === 'string' ? model : '';
}

export function wantsStream(body: JsonObject): boolean {
  return body['stream'] === true;
}

function validSessionId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 256 && !hasInvalidSessionChar(value)
    ? value
    : undefined;
}

function hasInvalidSessionChar(value: string): boolean {
  return value.split('').some((character) => {
    const code = character.codePointAt(0) ?? 0;

    return code <= 32 || code === 127;
  });
}

function metadataSessionId(body: JsonObject): string | undefined {
  const metadata = body['metadata'];

  if (!isJsonObject(metadata) || typeof metadata['user_id'] !== 'string') {
    return undefined;
  }

  const userId = parsedJson(metadata['user_id']);

  return isJsonObject(userId) ? validSessionId(userId['session_id']) : undefined;
}

export function requestSessionId(c: Context, body: JsonObject): string | undefined {
  const candidates = [
    c.req.header('x-session-id'),
    c.req.header('x-claude-code-session-id'),
    body['session_id'],
    body['sessionId'],
    body['conversation_id'],
    body['prompt_cache_key'],
    metadataSessionId(body),
  ];

  return candidates.map(validSessionId).find((value) => value !== undefined);
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
