import type { JsonObject } from '../gateway-wire';
import type { AntigravityReplayItem } from './antigravity-replay-items';

import { geminiClaudeToolUseId, isGeminiClaudeToolUseId } from '../dialect/gemini-tool-provenance';
import { isJsonObject } from '../gateway-wire';
import { canonicalJson } from './canonical-json';

type Identity = { id: string; name: string };

function stringField(value: JsonObject, key: string): string {
  return typeof value[key] === 'string' ? value[key].trim() : '';
}

function declarations(body: JsonObject): JsonObject[] {
  const tools = Array.isArray(body['tools']) ? body['tools'] : [];

  return tools.flatMap(declarationsIn);
}

function declarationsIn(tool: unknown): JsonObject[] {
  if (!isJsonObject(tool)) return [];

  const raw = tool['functionDeclarations'];

  if (!Array.isArray(raw)) return [];

  return raw.filter((value): value is JsonObject => isJsonObject(value));
}

function defaultsByTool(body: JsonObject): Map<string, JsonObject> {
  const defaults = new Map<string, JsonObject>();

  for (const declaration of declarations(body)) rememberDefaults(defaults, declaration);

  return defaults;
}

function rememberDefaults(defaults: Map<string, JsonObject>, declaration: JsonObject): void {
  const name = stringField(declaration, 'name');
  const schema = isJsonObject(declaration['parameters']) ? declaration['parameters'] : {};
  const properties = isJsonObject(schema['properties']) ? schema['properties'] : {};
  const values: JsonObject = {};

  for (const [key, property] of Object.entries(properties)) rememberDefault(values, key, property);

  if (name !== '') defaults.set(name, values);
}

function rememberDefault(values: JsonObject, key: string, property: unknown): void {
  if (!isJsonObject(property)) return;

  const fallback = property['default'];

  if (fallback !== undefined) values[key] = fallback;
}

function withoutDefaults(args: JsonObject, defaults: JsonObject | undefined): JsonObject {
  if (defaults === undefined) return args;

  const normalized = { ...args };

  for (const [key, value] of Object.entries(defaults)) {
    if (canonicalJson(normalized[key]) === canonicalJson(value)) delete normalized[key];
  }

  return normalized;
}

function sameArgs(
  item: AntigravityReplayItem,
  args: JsonObject,
  defaults: ReadonlyMap<string, JsonObject>,
): boolean {
  const declared = defaults.get(item.name);

  return (
    canonicalJson(withoutDefaults(item.args, declared)) ===
    canonicalJson(withoutDefaults(args, declared))
  );
}

function itemStableId(item: AntigravityReplayItem): string {
  return geminiClaudeToolUseId(item.id, item.name, item.args);
}

function matchingItem(
  call: JsonObject,
  items: readonly AntigravityReplayItem[],
  defaults: ReadonlyMap<string, JsonObject>,
): AntigravityReplayItem | undefined {
  const id = stringField(call, 'id');
  const name = stringField(call, 'name');
  const args = isJsonObject(call['args']) ? call['args'] : {};

  return items.find(
    (item) =>
      item.text === undefined &&
      item.name === name &&
      acceptedProvenanceId(id, item) &&
      sameArgs(item, args, defaults),
  );
}

function acceptedProvenanceId(id: string, item: AntigravityReplayItem): boolean {
  return id === item.id || id === itemStableId(item) || legacyToolId(id, item.name);
}

function legacyToolId(id: string, name: string): boolean {
  return id.startsWith(`${name}-`) && id.length > name.length + 1;
}

function callParts(contents: unknown[]): JsonObject[] {
  const parts: JsonObject[] = [];

  for (const content of contents) collectCallParts(content, parts);

  return parts;
}

function collectCallParts(content: unknown, parts: JsonObject[]): void {
  if (!isJsonObject(content)) return;

  const rawParts = content['parts'];

  if (!Array.isArray(rawParts)) return;

  for (const part of rawParts) rememberCallPart(parts, part);
}

function rememberCallPart(parts: JsonObject[], part: unknown): void {
  if (!isJsonObject(part)) return;
  if (isJsonObject(part['functionCall'])) parts.push(part);
}

function restoredCall(part: JsonObject, item: AntigravityReplayItem): JsonObject {
  const call = isJsonObject(part['functionCall']) ? part['functionCall'] : {};

  return {
    ...part,
    functionCall: { ...call, id: item.id, name: item.name, args: item.args },
    ...(item.signature === undefined ? {} : { thoughtSignature: item.signature }),
  };
}

function identityMap(items: readonly AntigravityReplayItem[]): Map<string, Identity> {
  const identities = new Map<string, Identity>();

  for (const item of items) {
    const stable = itemStableId(item);

    if (stable !== '') identities.set(stable, { id: item.id, name: item.name });
  }

  return identities;
}

function restoreCalls(
  contents: unknown[],
  items: readonly AntigravityReplayItem[],
  defaults: ReadonlyMap<string, JsonObject>,
  identities: Map<string, Identity>,
): void {
  let degraded = 0;

  for (const part of callParts(contents)) {
    const call = isJsonObject(part['functionCall']) ? part['functionCall'] : {};
    const currentId = stringField(call, 'id');
    const item = matchingItem(call, items, defaults);

    if (item !== undefined) {
      identities.set(currentId, { id: item.id, name: item.name });
      Object.assign(part, restoredCall(part, item));
    } else if (isGeminiClaudeToolUseId(currentId)) {
      const id = `call_recompose_${String(degraded)}`;

      degraded += 1;
      call['id'] = id;
      identities.set(currentId, { id, name: stringField(call, 'name') });
    }
  }
}

function restoreResponses(contents: unknown[], identities: ReadonlyMap<string, Identity>): void {
  for (const content of contents) restoreContentResponses(content, identities);
}

function hasLegacyCall(contents: unknown[], items: readonly AntigravityReplayItem[]): boolean {
  return callParts(contents).some((part) => {
    const call = isJsonObject(part['functionCall']) ? part['functionCall'] : {};
    const id = stringField(call, 'id');

    return items.some((item) => legacyToolId(id, item.name));
  });
}

function usesProvenance(
  body: JsonObject,
  contents: unknown[],
  items: readonly AntigravityReplayItem[],
): boolean {
  return JSON.stringify(body).includes('cpa_gemini_') || hasLegacyCall(contents, items);
}

function restoreContentResponses(
  content: unknown,
  identities: ReadonlyMap<string, Identity>,
): void {
  if (!isJsonObject(content) || !Array.isArray(content['parts'])) return;

  for (const part of content['parts']) restoreResponse(part, identities);
}

function restoreResponse(part: unknown, identities: ReadonlyMap<string, Identity>): void {
  if (!isJsonObject(part) || !isJsonObject(part['functionResponse'])) return;

  const response = part['functionResponse'];
  const identity = identities.get(stringField(response, 'id'));

  if (identity === undefined) return;

  response['id'] = identity.id;
  response['name'] = identity.name;
}

export function restoreAntigravityToolProvenance(
  body: JsonObject,
  items: readonly AntigravityReplayItem[],
): JsonObject {
  const rawContents = body['contents'];

  if (!Array.isArray(rawContents)) return body;
  if (!usesProvenance(body, rawContents, items)) return body;

  const restored = structuredClone(body);
  const contents = Array.isArray(restored['contents']) ? restored['contents'] : [];
  const identities = identityMap(items);

  restoreCalls(contents, items, defaultsByTool(restored), identities);
  restoreResponses(contents, identities);

  return restored;
}
