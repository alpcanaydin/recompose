import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

type HistoryState = { pending: string[]; latestReasoning?: string };

function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function toolCalls(message: JsonObject): JsonObject[] {
  const value = message['tool_calls'];

  return Array.isArray(value) ? value.filter(isJsonObject) : [];
}

function hasLegacyCall(message: JsonObject): boolean {
  const value = message['function_call'];

  return isJsonObject(value) && Object.keys(value).length > 0;
}

function emptyObjectPart(part: JsonObject): boolean {
  if ('text' in part) {
    const text = part['text'];

    return typeof text === 'string' ? text.trim() === '' : text === null || text === undefined;
  }

  if (part['type'] === 'text') return true;

  return Object.keys(part).length === 0;
}

function emptyContentPart(part: unknown): boolean {
  if (part === null || part === undefined) return true;
  if (typeof part === 'string') return part.trim() === '';

  return isJsonObject(part) ? emptyObjectPart(part) : false;
}

function emptyAssistantContent(content: unknown): boolean {
  if (content === null || content === undefined) return true;
  if (typeof content === 'string') return content.trim() === '';

  return Array.isArray(content) ? content.every(emptyContentPart) : false;
}

function dropsAssistant(message: JsonObject): boolean {
  if (message['role'] !== 'assistant') return false;
  if (toolCalls(message).length > 0) return false;
  if (hasLegacyCall(message)) return false;
  if (nonBlank(message['reasoning_content']) !== undefined) return false;

  return emptyAssistantContent(message['content']);
}

function contentReasoning(content: unknown): string | undefined {
  if (typeof content === 'string') return nonBlank(content)?.trim();
  if (!Array.isArray(content)) return undefined;

  const parts = content.flatMap((part) => {
    const text = isJsonObject(part) ? nonBlank(part['text']) : undefined;

    return text === undefined ? [] : [text.trim()];
  });

  return parts.length === 0 ? undefined : parts.join('\n');
}

function fallbackReasoning(message: JsonObject, state: HistoryState): string {
  return state.latestReasoning ?? contentReasoning(message['content']) ?? '[reasoning unavailable]';
}

function callIds(message: JsonObject): string[] {
  return toolCalls(message).flatMap((call) => {
    const id = nonBlank(call['id']);

    return id === undefined ? [] : [id];
  });
}

function normalizedAssistant(message: JsonObject, state: HistoryState): JsonObject {
  const reasoning = nonBlank(message['reasoning_content']);

  if (reasoning !== undefined) state.latestReasoning = reasoning;

  const ids = callIds(message);

  if (ids.length === 0) return message;

  state.pending.push(...ids);

  return reasoning === undefined
    ? { ...message, reasoning_content: fallbackReasoning(message, state) }
    : message;
}

function removePending(state: HistoryState, id: string): void {
  const index = state.pending.indexOf(id);

  if (index >= 0) state.pending.splice(index, 1);
}

function linkedToolId(message: JsonObject, state: HistoryState): string | undefined {
  return (
    nonBlank(message['tool_call_id']) ??
    nonBlank(message['call_id']) ??
    (state.pending.length === 1 ? state.pending[0] : undefined)
  );
}

function normalizedTool(message: JsonObject, state: HistoryState): JsonObject {
  const id = linkedToolId(message, state);

  if (id === undefined) return message;

  removePending(state, id);

  return nonBlank(message['tool_call_id']) === undefined
    ? { ...message, tool_call_id: id }
    : message;
}

function normalizedMessage(message: unknown, state: HistoryState): unknown {
  if (!isJsonObject(message)) return message;
  if (dropsAssistant(message)) return null;
  if (message['role'] === 'assistant') return normalizedAssistant(message, state);

  return message['role'] === 'tool' ? normalizedTool(message, state) : message;
}

export function normalizeKimiToolHistory(body: JsonObject): JsonObject {
  const messages = body['messages'];

  if (!Array.isArray(messages)) return body;

  const state: HistoryState = { pending: [] };
  const normalized = messages.flatMap((message) => {
    const result = normalizedMessage(message, state);

    return result === null ? [] : [result];
  });

  return normalized.length === messages.length &&
    normalized.every((message, index) => message === messages[index])
    ? body
    : { ...body, messages: normalized };
}
