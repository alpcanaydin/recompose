import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

type FunctionRef = { id: string; name: string; part: JsonObject };
type NormalizedContent = { content: JsonObject; pending: FunctionRef[] };

function refOf(part: unknown, key: 'functionCall' | 'functionResponse'): FunctionRef | null {
  if (!isJsonObject(part)) return null;

  const rawValue = part[key];

  if (!isJsonObject(rawValue)) return null;

  const id = typeof rawValue['id'] === 'string' ? rawValue['id'].trim() : '';
  const name = typeof rawValue['name'] === 'string' ? rawValue['name'].trim() : '';

  return { id, name, part };
}

function repairedResponse(response: FunctionRef, names: ReadonlyMap<string, string>): FunctionRef {
  if (!needsNameRepair(response)) return response;

  const name = names.get(response.id) ?? fallbackName(response.id);

  const rawResponse = response.part['functionResponse'];
  const functionResponse = isJsonObject(rawResponse) ? rawResponse : {};
  const part = { ...response.part, functionResponse: { ...functionResponse, name } };

  return { ...response, name, part };
}

function needsNameRepair(response: FunctionRef): boolean {
  return (
    response.id !== '' &&
    (response.name === '' || response.name === 'unknown' || response.name === response.id)
  );
}

function fallbackName(id: string): string {
  const segments = id.split('-');
  const semantic = segments.length > 2 ? segments.slice(0, -2).join('-') : '';

  return semantic === '' ? id : semantic;
}

function matchedResponse(call: FunctionRef, responses: FunctionRef[]): FunctionRef | undefined {
  if (call.id !== '') return responses.find((response) => response.id === call.id);
  if (call.name === '') return undefined;

  return responses.find((response) => response.name === call.name);
}

function orderedResponses(pending: FunctionRef[], responses: FunctionRef[]): JsonObject[] | null {
  if (pending.length !== responses.length) return null;

  const remaining = [...responses];
  const ordered: JsonObject[] = [];

  for (const call of pending) {
    const response = matchedResponse(call, remaining);

    if (response === undefined) return null;

    ordered.push(response.part);
    remaining.splice(remaining.indexOf(response), 1);
  }

  return ordered;
}

function contentParts(content: unknown): unknown[] | null {
  if (!isJsonObject(content)) return null;

  const rawParts = content['parts'];

  if (!Array.isArray(rawParts)) return null;

  const parts: unknown[] = rawParts;

  return parts;
}

function collectRefs(parts: unknown[], key: 'functionCall' | 'functionResponse'): FunctionRef[] {
  const refs: FunctionRef[] = [];

  for (const part of parts) {
    const ref = refOf(part, key);

    if (ref !== null) refs.push(ref);
  }

  return refs;
}

function rememberCallNames(names: Map<string, string>, parts: unknown[]): void {
  for (const call of collectRefs(parts, 'functionCall')) {
    if (call.id === '' || call.name === '' || call.name === 'unknown') continue;

    names.set(call.id, call.name);
  }
}

function callNames(contents: unknown[]): Map<string, string> {
  const names = new Map<string, string>();

  for (const content of contents) {
    const parts = contentParts(content);

    if (parts !== null) rememberCallNames(names, parts);
  }

  return names;
}

function normalizedResponses(
  content: JsonObject,
  pending: FunctionRef[],
  responses: FunctionRef[],
): NormalizedContent {
  const ordered = orderedResponses(pending, responses) ?? responses.map(({ part }) => part);

  return { content: { ...content, role: 'model', parts: ordered }, pending: [] };
}

function classifiedContent(
  content: JsonObject,
  pending: FunctionRef[],
  calls: FunctionRef[],
  responses: FunctionRef[],
  partCount: number,
): NormalizedContent {
  if (hasCallsWithoutResponses(calls, responses)) return { content, pending: calls };

  const hasOther = calls.length + responses.length !== partCount;

  if (responses.length === 0) return contentWithoutResponses(content, pending, hasOther);
  if (hasOther || calls.length > 0) return { content, pending: [] };

  return normalizedResponses(content, pending, responses);
}

function hasCallsWithoutResponses(calls: FunctionRef[], responses: FunctionRef[]): boolean {
  return calls.length > 0 && responses.length === 0;
}

function contentWithoutResponses(
  content: JsonObject,
  pending: FunctionRef[],
  hasOther: boolean,
): NormalizedContent {
  return { content, pending: hasOther ? [] : pending };
}

function normalizedContent(
  content: JsonObject,
  pending: FunctionRef[],
  names: ReadonlyMap<string, string>,
): NormalizedContent {
  const parts = contentParts(content);

  if (parts === null || parts.length === 0) return { content, pending: [] };

  const calls = collectRefs(parts, 'functionCall');
  const responses = collectRefs(parts, 'functionResponse').map((response) =>
    repairedResponse(response, names),
  );

  return classifiedContent(content, pending, calls, responses, parts.length);
}

export function normalizeAntigravityFunctionHistory(request: JsonObject): void {
  const rawContents = request['contents'];

  if (!Array.isArray(rawContents)) return;

  const contents: unknown[] = rawContents;
  const names = callNames(contents);
  const normalized: unknown[] = [];
  let pending: FunctionRef[] = [];

  for (const value of contents) {
    if (!isJsonObject(value)) {
      pending = [];
      normalized.push(value);
      continue;
    }

    const result = normalizedContent(value, pending, names);

    pending = result.pending;
    normalized.push(result.content);
  }

  request['contents'] = normalized;
}
