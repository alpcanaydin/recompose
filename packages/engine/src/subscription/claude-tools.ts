import { createHmac } from 'node:crypto';

import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

const SERVER_TOOL_PREFIXES = [
  'bash_',
  'code_execution_',
  'computer_',
  'memory_',
  'text_editor_',
  'tool_search_tool_',
  'web_fetch_',
  'web_search_',
];
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

export type ClaudeToolMap = Record<string, string>;

function isServerTool(type: unknown): boolean {
  const normalized = typeof type === 'string' ? type.trim().toLowerCase() : '';

  return SERVER_TOOL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isMcpName(name: string): boolean {
  return /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/u.test(name) && name.length <= 64;
}

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let encoded = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      encoded += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  return encoded;
}

function digest(secret: string, purpose: string, original: string, attempt: number): Uint8Array {
  const counter = Buffer.alloc(4);

  counter.writeUInt32BE(attempt);

  return createHmac('sha256', secret)
    .update('cpa-claude-mcp-alias-v2\0')
    .update(purpose)
    .update('\0')
    .update(original)
    .update(counter)
    .digest();
}

function semanticSuffix(original: string): string {
  const normalized = original
    .replace(/[^A-Za-z0-9_-]+/gu, '_')
    .replace(/^[_-]+|[_-]+$/gu, '')
    .slice(0, 32);

  return normalized === '' ? 'tool' : normalized;
}

export function claudeMcpAlias(secret: string, original: string, attempt = 0): string {
  const server = base32(digest(secret, 'server', '', 0)).slice(0, 12);
  const tool = base32(digest(secret, 'tool', original, attempt)).slice(0, 12);

  return `mcp__${server}__${tool}_${semanticSuffix(original)}`;
}

function declaredTools(body: JsonObject): JsonObject[] {
  const tools = Array.isArray(body['tools']) ? body['tools'] : [];

  return tools.filter(isJsonObject);
}

function reservedToolNames(tools: JsonObject[]): Set<string> {
  const names = tools
    .map((tool) => tool['name'])
    .filter((name): name is string => typeof name === 'string');

  return new Set(names);
}

function aliasableName(tool: JsonObject, forward: Record<string, string>): string | null {
  const name = tool['name'];

  if (typeof name !== 'string' || isServerTool(tool['type'])) {
    return null;
  }

  return isMcpName(name) || forward[name] !== undefined ? null : name;
}

function availableAlias(secret: string, name: string, reserved: Set<string>): string {
  let attempt = 0;
  let alias = claudeMcpAlias(secret, name, attempt);

  while (reserved.has(alias)) {
    attempt += 1;
    alias = claudeMcpAlias(secret, name, attempt);
  }

  return alias;
}

function aliasMaps(
  body: JsonObject,
  secret: string,
): {
  forward: Record<string, string>;
  reverse: ClaudeToolMap;
} {
  const tools = declaredTools(body);
  const reserved = reservedToolNames(tools);
  const forward: Record<string, string> = {};
  const reverse: ClaudeToolMap = {};

  for (const tool of tools) {
    const name = aliasableName(tool, forward);

    if (name === null) {
      continue;
    }

    const alias = availableAlias(secret, name, reserved);

    reserved.add(alias);
    forward[name] = alias;
    reverse[alias] = name;
  }

  return { forward, reverse };
}

function mappedName(value: unknown, forward: Record<string, string>): string | null {
  return typeof value === 'string' && forward[value] !== undefined ? forward[value] : null;
}

function renameReference(block: JsonObject, forward: Record<string, string>): void {
  const field = block['type'] === 'tool_use' ? 'name' : 'tool_name';
  const renamed = mappedName(block[field], forward);

  if (renamed !== null) {
    block[field] = renamed;
  }
}

function nestedBlocks(block: JsonObject): JsonObject[] {
  const content = Array.isArray(block['content']) ? block['content'] : [];

  return content.filter(isJsonObject);
}

function renameNestedReferences(block: JsonObject, forward: Record<string, string>): void {
  if (block['type'] !== 'tool_result') {
    return;
  }

  for (const item of nestedBlocks(block)) {
    if (item['type'] === 'tool_reference') {
      renameReference(item, forward);
    }
  }
}

function isToolReference(block: JsonObject): boolean {
  return block['type'] === 'tool_use' || block['type'] === 'tool_reference';
}

function renameMessageBlock(block: JsonObject, forward: Record<string, string>): void {
  if (isToolReference(block)) {
    renameReference(block, forward);
  }

  renameNestedReferences(block, forward);
}

function renameMessageReferences(body: JsonObject, forward: Record<string, string>): void {
  const messages = Array.isArray(body['messages']) ? body['messages'] : [];

  for (const message of messages.filter(isJsonObject)) {
    const content = Array.isArray(message['content']) ? message['content'] : [];

    for (const block of content.filter(isJsonObject)) {
      renameMessageBlock(block, forward);
    }
  }
}

function renameDeclaredTools(body: JsonObject, forward: Record<string, string>): void {
  for (const tool of declaredTools(body)) {
    const renamed = mappedName(tool['name'], forward);

    if (renamed !== null) {
      tool['name'] = renamed;
      delete tool['type'];
    }
  }
}

function renameToolChoice(body: JsonObject, forward: Record<string, string>): void {
  const choice = body['tool_choice'];

  if (!isJsonObject(choice) || choice['type'] !== 'tool') {
    return;
  }

  const renamed = mappedName(choice['name'], forward);

  if (renamed !== null) {
    choice['name'] = renamed;
  }
}

export function prepareClaudeTools(
  body: JsonObject,
  secret: string,
): { body: JsonObject; reverse: ClaudeToolMap } {
  const cloned = structuredClone(body);
  const { forward, reverse } = aliasMaps(cloned, secret);

  renameDeclaredTools(cloned, forward);
  renameToolChoice(cloned, forward);
  renameMessageReferences(cloned, forward);

  return { body: cloned, reverse };
}
