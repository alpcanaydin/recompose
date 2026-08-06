import type { Context } from 'hono';

import type { ChatMessage } from './dialect/chat-completions-wire';
import type { RequestOf } from './dialect/dispatcher';
import type { HubMessage } from './dialect/hub';

export type ProxyDialect = 'anthropic' | 'chat-completions';

export type JsonObject = Record<string, unknown>;

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

function isHubMessage(value: unknown): value is HubMessage {
  if (!isJsonObject(value)) {
    return false;
  }

  const role = value['role'];

  return (role === 'user' || role === 'assistant') && Array.isArray(value['content']);
}

function speaksTheHub(body: JsonObject): body is JsonObject & RequestOf['anthropic'] {
  const messages = body['messages'];

  return Array.isArray(messages) && messages.every(isHubMessage);
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

export function ingressPayload(
  dialect: ProxyDialect,
  body: JsonObject,
): RequestOf[ProxyDialect] | null {
  if (dialect === 'anthropic') {
    return speaksTheHub(body) ? body : null;
  }

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
