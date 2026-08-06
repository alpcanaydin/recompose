import type { JsonObject } from '../gateway-wire';
import type { ClaudeToolMap } from './claude-tools';

import { isJsonObject, parsedJson } from '../gateway-wire';

function isToolReference(block: JsonObject): boolean {
  return block['type'] === 'tool_use' || block['type'] === 'tool_reference';
}

function restoreReference(block: JsonObject, reverse: ClaudeToolMap): void {
  const field = block['type'] === 'tool_use' ? 'name' : 'tool_name';
  const value = block[field];
  const original = typeof value === 'string' ? reverse[value] : undefined;

  if (original !== undefined) {
    block[field] = original;
  }
}

function nestedBlocks(block: JsonObject): JsonObject[] {
  const content = Array.isArray(block['content']) ? block['content'] : [];

  return content.filter(isJsonObject);
}

function restoreNestedReferences(block: JsonObject, reverse: ClaudeToolMap): void {
  if (block['type'] !== 'tool_result') {
    return;
  }

  for (const item of nestedBlocks(block)) {
    if (item['type'] === 'tool_reference') {
      restoreReference(item, reverse);
    }
  }
}

function restoreContentBlock(block: JsonObject, reverse: ClaudeToolMap): void {
  if (isToolReference(block)) {
    restoreReference(block, reverse);
  }

  restoreNestedReferences(block, reverse);
}

export function restoreClaudeToolBody(body: JsonObject, reverse: ClaudeToolMap): JsonObject {
  const cloned = structuredClone(body);
  const content = Array.isArray(cloned['content']) ? cloned['content'] : [];

  for (const block of content.filter(isJsonObject)) {
    restoreContentBlock(block, reverse);
  }

  return cloned;
}

function dataPrefix(line: string): string | null {
  if (line.startsWith('data: ')) {
    return 'data: ';
  }

  return line.startsWith('data:') ? 'data:' : null;
}

function contentBlockOf(parsed: unknown): JsonObject | null {
  return isJsonObject(parsed) && isJsonObject(parsed['content_block'])
    ? parsed['content_block']
    : null;
}

export function restoreClaudeToolSseLine(line: string, reverse: ClaudeToolMap): string {
  const prefix = dataPrefix(line);

  if (prefix === null) {
    return line;
  }

  const parsed = parsedJson(line.slice(prefix.length));
  const block = contentBlockOf(parsed);

  if (!isJsonObject(parsed) || block === null || !isToolReference(block)) {
    return line;
  }

  restoreReference(block, reverse);

  return `${prefix}${JSON.stringify(parsed)}`;
}

function restoredSseBody(
  body: ReadableStream<Uint8Array>,
  reverse: ClaudeToolMap,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = '';

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffered += decoder.decode(chunk, { stream: true });
        const lines = buffered.split('\n');

        buffered = lines.pop() ?? '';

        for (const line of lines) {
          controller.enqueue(encoder.encode(`${restoreClaudeToolSseLine(line, reverse)}\n`));
        }
      },
      flush(controller) {
        buffered += decoder.decode();

        if (buffered !== '') {
          controller.enqueue(encoder.encode(restoreClaudeToolSseLine(buffered, reverse)));
        }
      },
    }),
  );
}

function transformedHeaders(response: Response): Headers {
  const headers = new Headers(response.headers);

  headers.delete('content-length');

  return headers;
}

function responseInit(response: Response): ResponseInit {
  return {
    status: response.status,
    statusText: response.statusText,
    headers: transformedHeaders(response),
  };
}

function isSse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('text/event-stream') === true;
}

async function restoredJsonResponse(response: Response, reverse: ClaudeToolMap): Promise<Response> {
  const text = await response.text();
  const parsed = parsedJson(text);
  const restored = isJsonObject(parsed)
    ? JSON.stringify(restoreClaudeToolBody(parsed, reverse))
    : text;

  return new Response(restored, responseInit(response));
}

export async function restoreClaudeToolResponse(
  response: Response,
  reverse: ClaudeToolMap,
): Promise<Response> {
  if (Object.keys(reverse).length === 0 || response.body === null) {
    return response;
  }

  if (isSse(response)) {
    return new Response(restoredSseBody(response.body, reverse), responseInit(response));
  }

  return restoredJsonResponse(response, reverse);
}
