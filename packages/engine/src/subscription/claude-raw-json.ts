import type { JsonObject } from '../gateway-wire';
import type { ClaudeToolMap } from './claude-tools';

import { isJsonObject } from '../gateway-wire';
import { claudeMcpAlias, prepareClaudeTools } from './claude-tools';

export type ClaudeRawJsonEdit = { start: number; end: number; replacement?: Uint8Array };

export function applyClaudeRawJsonEdits(
  body: Uint8Array,
  edits: readonly ClaudeRawJsonEdit[],
): Uint8Array | null {
  const ordered = [...edits].toSorted((left, right) => left.start - right.start);

  if (!validEdits(body.byteLength, ordered)) return null;
  if (ordered.length === 0) return body;

  const chunks: Uint8Array[] = [];
  let offset = 0;

  for (const edit of ordered) {
    chunks.push(body.subarray(offset, edit.start), edit.replacement ?? new Uint8Array());
    offset = edit.end;
  }

  chunks.push(body.subarray(offset));

  return joined(chunks);
}

function validEdits(length: number, edits: readonly ClaudeRawJsonEdit[]): boolean {
  let offset = 0;

  for (const edit of edits) {
    if (!validEdit(length, offset, edit)) return false;

    offset = edit.end;
  }

  return true;
}

function validEdit(length: number, offset: number, edit: ClaudeRawJsonEdit): boolean {
  if (edit.start < offset || edit.start < 0) return false;

  return edit.end >= edit.start && edit.end <= length;
}

function joined(chunks: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

export function remapClaudeToolNamesRaw(
  body: Uint8Array,
  secret: string,
): { body: Uint8Array; reverse: ClaudeToolMap; fallback: boolean } {
  const text = new TextDecoder().decode(body);
  const parsed = parsedObject(text);

  if (parsed === null) return fallbackRemap(body, text, secret);

  const { reverse } = prepareClaudeTools(parsed, secret);
  const forward = forwardMap(reverse);

  addCoercedDeclarations(parsed, secret, forward, reverse);
  const edits = rawNameEdits(text, forward);
  const remapped = applyClaudeRawJsonEdits(body, edits);

  return remapped === null
    ? { body, reverse: {}, fallback: true }
    : { body: remapped, reverse, fallback: false };
}

function fallbackRemap(
  body: Uint8Array,
  text: string,
  secret: string,
): { body: Uint8Array; reverse: ClaudeToolMap; fallback: boolean } {
  const forward: Record<string, string> = {};
  const reverse: ClaudeToolMap = {};
  const pattern = /"name"\s*:\s*("(?:\\.|[^"\\])*")/gu;

  for (const match of text.matchAll(pattern)) addFallbackAlias(match[1], secret, forward, reverse);

  return {
    body: applyClaudeRawJsonEdits(body, rawNameEdits(text, forward)) ?? body,
    reverse,
    fallback: true,
  };
}

function addFallbackAlias(
  token: string | undefined,
  secret: string,
  forward: Record<string, string>,
  reverse: ClaudeToolMap,
): void {
  if (token === undefined) return;

  const decoded: unknown = JSON.parse(token);

  if (typeof decoded !== 'string' || decoded.startsWith('mcp__')) return;

  const alias = claudeMcpAlias(secret, decoded);

  forward[decoded] = alias;
  reverse[alias] = decoded;
}

function parsedObject(text: string): JsonObject | null {
  try {
    const parsed: unknown = JSON.parse(text);

    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function forwardMap(reverse: ClaudeToolMap): Record<string, string> {
  return Object.fromEntries(Object.entries(reverse).map(([alias, original]) => [original, alias]));
}

function addCoercedDeclarations(
  body: JsonObject,
  secret: string,
  forward: Record<string, string>,
  reverse: ClaudeToolMap,
): void {
  const tools = Array.isArray(body['tools']) ? body['tools'] : [];

  for (const tool of tools) addCoercedDeclaration(tool, secret, forward, reverse);
}

function addCoercedDeclaration(
  value: unknown,
  secret: string,
  forward: Record<string, string>,
  reverse: ClaudeToolMap,
): void {
  if (!isJsonObject(value) || typeof value['name'] === 'string') return;

  const original = primitiveName(value['name']);

  if (original === null) return;
  const alias = claudeMcpAlias(secret, original);

  forward[original] = alias;
  reverse[alias] = original;
}

function primitiveName(value: unknown): string | null {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  return null;
}

function rawNameEdits(text: string, forward: Record<string, string>): ClaudeRawJsonEdit[] {
  const edits: ClaudeRawJsonEdit[] = [];
  const pattern =
    /"(?:name|tool_name)"\s*:\s*("(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?|true|false|null)/gu;

  for (const match of text.matchAll(pattern)) appendNameEdit(text, match, forward, edits);

  return edits;
}

function appendNameEdit(
  text: string,
  match: RegExpMatchArray,
  forward: Record<string, string>,
  edits: ClaudeRawJsonEdit[],
): void {
  const token = tokenInfo(match);

  if (token === null) return;

  const original = originalName(token.value);

  if (original === null) return;

  const alias = forward[original];

  if (alias === undefined) return;

  edits.push({
    start: new TextEncoder().encode(text.slice(0, token.start)).byteLength,
    end: new TextEncoder().encode(text.slice(0, token.start + token.value.length)).byteLength,
    replacement: new TextEncoder().encode(JSON.stringify(alias)),
  });
}

function originalName(token: string): string | null {
  const decoded: unknown = JSON.parse(token);

  if (typeof decoded === 'string') return decoded;

  return primitiveName(decoded);
}

function tokenInfo(match: RegExpMatchArray): { value: string; start: number } | null {
  const value = match[1];

  if (match.index === undefined || value === undefined) return null;

  return { value, start: match.index + match[0].lastIndexOf(value) };
}
