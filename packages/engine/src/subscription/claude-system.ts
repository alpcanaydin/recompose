import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { claudeLocalDate } from './claude-timezone';

const CLI_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";
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

function forwardedSystemText(text: unknown): string[] {
  if (typeof text !== 'string' || text.trim() === '') {
    return [];
  }

  const native = text === CLI_IDENTITY || text.startsWith('x-anthropic-billing-header:');

  return native ? [] : [text];
}

function systemTexts(value: unknown): string[] {
  if (typeof value === 'string') {
    return forwardedSystemText(value);
  }

  return Array.isArray(value)
    ? value.flatMap((block) =>
        isJsonObject(block) && block['type'] === 'text' ? forwardedSystemText(block['text']) : [],
      )
    : [];
}

function modelNameOf(value: unknown): string {
  return typeof value === 'string' ? (value.toLowerCase().split('/').at(-1) ?? '') : '';
}

function firstUserIndex(messages: unknown[]): number {
  return messages.findIndex((message) => isJsonObject(message) && message['role'] === 'user');
}

function textBlock(text: string, cached = false): JsonObject {
  return {
    type: 'text',
    text,
    ...(cached ? { cache_control: { type: 'ephemeral' } } : {}),
  };
}

function reminderText(text: string): string {
  return `<system-reminder>\n${text}${text.endsWith('\n') ? '' : '\n'}</system-reminder>`;
}

function contentBlocks(value: unknown): unknown[] {
  return typeof value === 'string' ? [textBlock(value)] : Array.isArray(value) ? value : [];
}

function afterLeadingToolResults(blocks: unknown[]): number {
  const at = blocks.findIndex((block) => !isJsonObject(block) || block['type'] !== 'tool_result');

  return at < 0 ? blocks.length : at;
}

function legacyMessages(messages: unknown[], texts: string[]): unknown[] {
  const index = firstUserIndex(messages);
  const selected = messages[index];

  if (index < 0 || !isJsonObject(selected)) {
    return messages;
  }

  const blocks = contentBlocks(selected['content']);
  const at = afterLeadingToolResults(blocks);
  const reminders = texts.map((text) => textBlock(reminderText(text)));
  const next = [...messages];

  next[index] = {
    ...selected,
    content: [...blocks.slice(0, at), ...reminders, ...blocks.slice(at)],
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
  const inserted = texts.map((text) => ({ role: 'system', content: [textBlock(text, true)] }));

  return [...messages.slice(0, at), ...inserted, ...messages.slice(at)];
}

function relocateCallerSystem(body: JsonObject): JsonObject {
  const cloned = structuredClone(body);
  const texts = systemTexts(cloned['system']);
  const messages = Array.isArray(cloned['messages']) ? cloned['messages'] : [];

  delete cloned['system'];

  if (texts.length > 0) {
    cloned['messages'] = legacyModels.has(modelNameOf(cloned['model']))
      ? legacyMessages(messages, texts)
      : modernMessages(messages, texts);
  }

  return cloned;
}

function currentDateReminder(now: number, timezone?: string): string {
  return `<system-reminder>
As you answer the user's questions, you can use the following context:
# currentDate
Today's date is ${claudeLocalDate(now, timezone)}.

      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.
</system-reminder>

`;
}

function isCurrentDateBlock(value: unknown): boolean {
  return (
    isJsonObject(value) &&
    value['type'] === 'text' &&
    typeof value['text'] === 'string' &&
    value['text'].startsWith('<system-reminder>\nAs you answer the user') &&
    value['text'].includes('# currentDate')
  );
}

function cacheableUserText(block: unknown): block is JsonObject {
  return (
    isJsonObject(block) &&
    block['type'] === 'text' &&
    typeof block['text'] === 'string' &&
    !block['text'].startsWith('<system-reminder>')
  );
}

function cacheFirstUserText(blocks: unknown[]): unknown[] {
  let cached = false;

  return blocks.map((block) => {
    if (!cached && cacheableUserText(block)) {
      cached = true;

      return { ...block, cache_control: { type: 'ephemeral' } };
    }

    return block;
  });
}

function arrayCopy(value: unknown): unknown[] {
  return Array.isArray(value) ? value.map((item: unknown) => item) : [];
}

function withCurrentDate(body: JsonObject, now: number, timezone?: string): JsonObject {
  const messages = arrayCopy(body['messages']);
  const index = firstUserIndex(messages);
  const selected = messages[index];

  if (index < 0 || !isJsonObject(selected)) {
    return body;
  }

  const withoutDate = contentBlocks(selected['content']).filter(
    (block) => !isCurrentDateBlock(block),
  );

  messages[index] = {
    ...selected,
    content: [textBlock(currentDateReminder(now, timezone)), ...cacheFirstUserText(withoutDate)],
  };

  return { ...body, messages };
}

export function claudeMessagesSystem(body: JsonObject, now: number, timezone?: string): JsonObject {
  return withCurrentDate(relocateCallerSystem(body), now, timezone);
}

export function claudeCountTokensSystem(body: JsonObject): JsonObject {
  return relocateCallerSystem(body);
}
