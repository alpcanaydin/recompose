import { createHash } from 'node:crypto';

import { isJsonObject } from '../gateway-wire';
import { xxhash64 } from './xxhash64';

type JsonObject = Record<string, unknown>;

const CCH_SEED = 0x4d65_9218_e32a_3268n;
const BILLING_PREFIX = 'x-anthropic-billing-header:';
const CLAUDE_CODE_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";
const OMITTED_KEYS = new Set(['max_tokens', 'fallbacks', 'fallback_credit_token']);

function lastUserText(body: JsonObject): string {
  const messages = Array.isArray(body['messages']) ? body['messages'] : [];
  let found = '';

  for (const message of messages) {
    found = userText(message) || found;
  }

  return found;
}

function userText(message: unknown): string {
  return isJsonObject(message) && message['role'] === 'user'
    ? textFromContent(message['content'])
    : '';
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content.reduce<string>((found, part) => {
    return isJsonObject(part) && part['type'] === 'text' && typeof part['text'] === 'string'
      ? part['text']
      : found;
  }, '');
}

function billingFingerprint(message: string): string {
  const characters = Array.from(message);
  const sampled = [4, 7, 20].map((index) => characters[index] ?? '0').join('');

  return createHash('sha256').update(`59cf53e54c78${sampled}2.1.220`).digest('hex').slice(0, 3);
}

export function claudeBillingFingerprint(body: JsonObject): string {
  return billingFingerprint(lastUserText(body));
}

function billingText(body: JsonObject): string {
  return `${BILLING_PREFIX} cc_version=2.1.220.${claudeBillingFingerprint(body)}; cc_entrypoint=cli; cch=00000;`;
}

function systemBlocks(value: unknown): unknown[] {
  if (typeof value === 'string') {
    return [{ type: 'text', text: value }];
  }

  return Array.isArray(value) ? value : [];
}

function existingBilling(blocks: unknown[]): string | undefined {
  const first = blocks[0];
  const text = isJsonObject(first) ? first['text'] : undefined;

  return typeof text === 'string' && text.startsWith(BILLING_PREFIX) ? text : undefined;
}

function withCchPlaceholder(text: string): string {
  if (/ cch=[a-f\d]{5};/u.test(text) || !text.includes('cc_entrypoint=')) {
    return text;
  }

  return text.replace(/(cc_entrypoint=[^;]+;)/u, '$1 cch=00000;');
}

function withBilling(body: JsonObject): JsonObject {
  const cloned = structuredClone(body);
  const blocks = systemBlocks(cloned['system']);
  const billing = existingBilling(blocks);

  if (billing !== undefined && isJsonObject(blocks[0])) {
    blocks[0] = { ...blocks[0], text: withCchPlaceholder(billing) };
    cloned['system'] = blocks;
    enforceFourCacheBreakpoints(cloned);

    return cloned;
  }

  cloned['system'] = [
    { type: 'text', text: billingText(cloned) },
    {
      type: 'text',
      text: CLAUDE_CODE_IDENTITY,
      cache_control: { type: 'ephemeral' },
    },
    ...blocks,
  ];

  enforceFourCacheBreakpoints(cloned);

  return cloned;
}

function controlledBlocks(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (block): block is JsonObject => isJsonObject(block) && block['cache_control'] !== undefined,
      )
    : [];
}

function controlledMessageBlocks(body: JsonObject): JsonObject[] {
  const messages = Array.isArray(body['messages']) ? body['messages'] : [];

  return messages.flatMap((message) =>
    isJsonObject(message) ? controlledBlocks(message['content']) : [],
  );
}

function enforceFourCacheBreakpoints(body: JsonObject): void {
  const tools = controlledBlocks(body['tools']);
  const system = controlledBlocks(body['system']);
  const messages = controlledMessageBlocks(body);
  const controlled = [...tools, ...system, ...messages];
  const removalOrder = [
    ...system.slice(0, -1),
    ...tools.slice(0, -1),
    ...messages,
    ...system.slice(-1),
    ...tools.slice(-1),
  ];

  for (const block of removalOrder.slice(0, Math.max(0, controlled.length - 4))) {
    delete block['cache_control'];
  }
}

function normalizedCchValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizedCchValue);
  }

  if (!isJsonObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, member]) => {
      if (OMITTED_KEYS.has(key)) {
        return [];
      }

      return [
        [key, key === 'model' && typeof member === 'string' ? '' : normalizedCchValue(member)],
      ];
    }),
  );
}

function cchFor(serialized: string): string {
  const parsed: unknown = JSON.parse(serialized);
  const normalized = JSON.stringify(normalizedCchValue(parsed));
  const hash = xxhash64(new TextEncoder().encode(normalized), CCH_SEED);

  return (hash & 0xf_ffffn).toString(16).padStart(5, '0');
}

export function signedClaudeBody(body: JsonObject): string {
  const serialized = JSON.stringify(withBilling(body));
  const cch = cchFor(serialized.replace(/ cch=[a-f\d]{5};/u, ' cch=00000;'));

  return serialized.replace(/ cch=[a-f\d]{5};/u, ` cch=${cch};`);
}
