import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { claudeProviderRequest } from './claude-request';

const COUNT_BETAS = [
  'claude-code-20250219',
  'oauth-2025-04-20',
  ['interleaved', 'thinking', '2025-05-14'].join('-'),
  'context-management-2025-06-27',
  'token-counting-2024-11-01',
].join(',');

const legacyModels = new Set([
  'claude-3-5-haiku-20241022',
  'claude-3-5-haiku-latest',
  'claude-3-7-sonnet-20250219',
  'claude-3-7-sonnet-latest',
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
  'claude-opus-4',
  'claude-opus-4-20250514',
  'claude-opus-4-1',
  'claude-opus-4-1-20250805',
  'claude-opus-4-5',
  'claude-opus-4-5-20251101',
  'claude-opus-4-6',
  'claude-opus-4-7',
  'claude-sonnet-4',
  'claude-sonnet-4-20250514',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-6',
]);

function systemTexts(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [value];
  }

  return Array.isArray(value)
    ? value.flatMap((block) =>
        isJsonObject(block) && block['type'] === 'text' && typeof block['text'] === 'string'
          ? [block['text']]
          : [],
      )
    : [];
}

function firstUserIndex(messages: unknown[]): number {
  return messages.findIndex((message) => isJsonObject(message) && message['role'] === 'user');
}

function reminder(text: string): JsonObject {
  return {
    type: 'text',
    text: `<system-reminder>\n${text}${text.endsWith('\n') ? '' : '\n'}</system-reminder>`,
  };
}

function legacyMessages(messages: unknown[], texts: string[]): unknown[] {
  const index = firstUserIndex(messages);

  if (index < 0) {
    return messages;
  }

  const selected = messages[index];

  if (!isJsonObject(selected)) {
    return messages;
  }

  const content = selected['content'];
  const original: unknown[] =
    typeof content === 'string'
      ? [{ type: 'text', text: content }]
      : Array.isArray(content)
        ? content
        : [];
  const next = [...messages];

  next[index] = {
    ...selected,
    content: [...texts.map(reminder), ...original],
  };

  return next;
}

function afterOpeningUsers(messages: unknown[], first: number): number {
  const offset = messages.slice(first + 1).findIndex((message) => {
    return !isJsonObject(message) || message['role'] !== 'user';
  });

  return offset < 0 ? messages.length : first + 1 + offset;
}

function modernMessages(messages: unknown[], texts: string[]): unknown[] {
  const first = firstUserIndex(messages);

  if (first < 0) {
    return messages;
  }

  const at = afterOpeningUsers(messages, first);
  const inserted = texts.map((text) => ({
    role: 'system',
    content: [{ type: 'text', text, cache_control: { type: 'ephemeral' } }],
  }));

  return [...messages.slice(0, at), ...inserted, ...messages.slice(at)];
}

function modelNameOf(value: unknown): string {
  return typeof value === 'string' ? (value.toLowerCase().split('/').at(-1) ?? '') : '';
}

function relocatedMessages(body: JsonObject, texts: string[]): unknown[] {
  const messages = Array.isArray(body['messages']) ? body['messages'] : [];

  return legacyModels.has(modelNameOf(body['model']))
    ? legacyMessages(messages, texts)
    : modernMessages(messages, texts);
}

function relocateSystem(body: JsonObject): JsonObject {
  const cloned = structuredClone(body);
  const texts = systemTexts(cloned['system']);

  delete cloned['system'];

  if (texts.length > 0) {
    cloned['messages'] = relocatedMessages(cloned, texts);
  }

  return cloned;
}

function countBody(body: string): string {
  const parsed = parsedJson(body);

  if (!isJsonObject(parsed)) {
    throw new Error('the prepared Claude count request was not an object');
  }

  delete parsed['system'];
  delete parsed['metadata'];
  delete parsed['context_management'];
  delete parsed['diagnostics'];

  return JSON.stringify(parsed);
}

function countHeaders(headers: [string, string][]): [string, string][] {
  return headers.flatMap(([name, value]) => {
    if (name === 'X-Stainless-Timeout') {
      return [];
    }

    return [[name, name === 'anthropic-beta' ? COUNT_BETAS : value]];
  });
}

export function claudeCountTokensProviderRequest(
  providerOrigin: string,
  rawBody: JsonObject,
  accessToken: string,
  ids: { sessionId: string; requestId: string },
): ProviderRequest {
  const prepared = claudeProviderRequest(providerOrigin, relocateSystem(rawBody), accessToken, ids);

  return {
    ...prepared,
    url: `${providerOrigin.replace(/\/+$/u, '')}/v1/messages/count_tokens?beta=true`,
    body: countBody(prepared.body),
    headers: countHeaders(prepared.headers),
  };
}
