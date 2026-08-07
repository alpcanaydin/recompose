import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

export type CodexImageResult = {
  result: string;
  revisedPrompt: string;
  outputFormat: string;
  size: string;
  background: string;
  quality: string;
};

export type CodexImageExtraction = {
  results: CodexImageResult[];
  createdAt: number;
  usage?: JsonObject;
  firstMeta?: CodexImageResult;
};

function text(item: JsonObject, field: string): string {
  const value = item[field];

  return typeof value === 'string' ? value.trim() : '';
}

function imageResult(item: unknown): CodexImageResult | null {
  if (!isJsonObject(item) || item['type'] !== 'image_generation_call') return null;

  const result = text(item, 'result');

  if (result === '') return null;

  return {
    result,
    revisedPrompt: text(item, 'revised_prompt'),
    outputFormat: text(item, 'output_format'),
    size: text(item, 'size'),
    background: text(item, 'background'),
    quality: text(item, 'quality'),
  };
}

function imageResults(items: readonly unknown[]): CodexImageResult[] {
  return items.flatMap((item) => {
    const result = imageResult(item);

    return result === null ? [] : [result];
  });
}

function orderedItems(indexed: ReadonlyMap<number, JsonObject>): JsonObject[] {
  return [...indexed.entries()].sort(([left], [right]) => left - right).map(([, item]) => item);
}

function completedOutput(response: JsonObject): unknown[] {
  return Array.isArray(response['output']) ? response['output'] : [];
}

function fallbackOutput(
  indexed: ReadonlyMap<number, JsonObject>,
  fallback: readonly JsonObject[],
): JsonObject[] {
  return [...orderedItems(indexed), ...fallback];
}

function createdAt(response: JsonObject, now: () => number): number {
  const created = response['created_at'];

  return typeof created === 'number' && created > 0 ? created : Math.floor(now() / 1000);
}

function completedResponse(completed: JsonObject): JsonObject {
  if (completed['type'] !== 'response.completed') throw new Error('unexpected event type');

  const response = completed['response'];

  if (!isJsonObject(response)) throw new Error('completed response is missing');

  return response;
}

function selectedItems(
  response: JsonObject,
  indexed: ReadonlyMap<number, JsonObject>,
  fallback: readonly JsonObject[],
): unknown[] {
  const output = completedOutput(response);

  return output.length > 0 ? output : fallbackOutput(indexed, fallback);
}

function imageUsage(response: JsonObject): JsonObject | undefined {
  const toolUsage = response['tool_usage'];
  const usage = isJsonObject(toolUsage) ? toolUsage['image_gen'] : undefined;

  return isJsonObject(usage) ? usage : undefined;
}

function extractionOf(
  response: JsonObject,
  results: CodexImageResult[],
  now: () => number,
): CodexImageExtraction {
  const usage = imageUsage(response);
  const firstMeta = results[0];

  return {
    results,
    createdAt: createdAt(response, now),
    ...(usage === undefined ? {} : { usage }),
    ...(firstMeta === undefined ? {} : { firstMeta }),
  };
}

export function extractCodexImageResults(
  completed: JsonObject,
  indexed: ReadonlyMap<number, JsonObject> = new Map(),
  fallback: readonly JsonObject[] = [],
  now: () => number = Date.now,
): CodexImageExtraction {
  const response = completedResponse(completed);
  const results = imageResults(selectedItems(response, indexed, fallback));

  return extractionOf(response, results, now);
}
