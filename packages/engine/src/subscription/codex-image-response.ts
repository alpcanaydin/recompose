import type { JsonObject } from '../gateway-wire';
import type { CodexImageExtraction, CodexImageResult } from './codex-image-results';

import { isJsonObject, jsonResponse } from '../gateway-wire';
import { jsonEventsFrom, namedSseBodyFrom } from '../stream-wire';
import { extractCodexImageResults } from './codex-image-results';

type CollectedImages = { indexed: Map<number, JsonObject>; fallback: JsonObject[] };

const EMPTY_IMAGE_RESULT: CodexImageResult = {
  result: '',
  revisedPrompt: '',
  outputFormat: '',
  size: '',
  background: '',
  quality: '',
};

function collectItem(event: JsonObject, collected: CollectedImages): void {
  if (event['type'] !== 'response.output_item.done' || !isJsonObject(event['item'])) return;

  const index = event['output_index'];

  if (typeof index === 'number') collected.indexed.set(index, event['item']);
  else collected.fallback.push(event['item']);
}

function mimeType(format: string): string {
  if (['jpg', 'jpeg'].includes(format.trim().toLowerCase())) return 'image/jpeg';

  return format.trim().toLowerCase() === 'webp' ? 'image/webp' : 'image/png';
}

function imageValue(result: CodexImageResult, responseFormat: string): JsonObject {
  const output =
    responseFormat.trim().toLowerCase() === 'url'
      ? { url: `data:${mimeType(result.outputFormat)};base64,${result.result}` }
      : { b64_json: result.result };

  return {
    ...output,
    ...(result.revisedPrompt === '' ? {} : { revised_prompt: result.revisedPrompt }),
  };
}

function optionalText(field: string, value: string): JsonObject {
  return value === '' ? {} : { [field]: value };
}

function imageMetadata(meta: CodexImageResult | undefined): JsonObject {
  const value = meta ?? EMPTY_IMAGE_RESULT;

  return {
    ...optionalText('background', value.background),
    ...optionalText('output_format', value.outputFormat),
    ...optionalText('quality', value.quality),
    ...optionalText('size', value.size),
  };
}

function imageApiBody(extraction: CodexImageExtraction, responseFormat: string): JsonObject {
  return {
    created: extraction.createdAt,
    data: extraction.results.map((result) => imageValue(result, responseFormat)),
    ...imageMetadata(extraction.firstMeta),
    ...(extraction.usage === undefined ? {} : { usage: extraction.usage }),
  };
}

function partialResult(event: JsonObject): string {
  return typeof event['partial_image_b64'] === 'string' ? event['partial_image_b64'] : '';
}

function partialIndex(event: JsonObject): number {
  return typeof event['partial_image_index'] === 'number' ? event['partial_image_index'] : 0;
}

function partialFormat(event: JsonObject): string {
  return typeof event['output_format'] === 'string' ? event['output_format'] : '';
}

function partialEvent(
  event: JsonObject,
  prefix: string,
  responseFormat: string,
): JsonObject | null {
  if (event['type'] !== 'response.image_generation_call.partial_image') return null;

  const result = partialResult(event);

  if (result.trim() === '') return null;

  return {
    type: `${prefix}.partial_image`,
    partial_image_index: partialIndex(event),
    ...imageValue(
      {
        result,
        revisedPrompt: '',
        outputFormat: partialFormat(event),
        size: '',
        background: '',
        quality: '',
      },
      responseFormat,
    ),
  };
}

function completedEvents(
  event: JsonObject,
  collected: CollectedImages,
  prefix: string,
  responseFormat: string,
): JsonObject[] {
  if (event['type'] !== 'response.completed') return [];

  const extraction = extractCodexImageResults(event, collected.indexed, collected.fallback);

  return extraction.results.map((result) => ({
    type: `${prefix}.completed`,
    ...imageValue(result, responseFormat),
    ...(extraction.usage === undefined ? {} : { usage: extraction.usage }),
  }));
}

async function* imageEvents(
  body: ReadableStream<Uint8Array>,
  prefix: string,
  responseFormat: string,
): AsyncIterable<JsonObject & { type: string }> {
  const collected: CollectedImages = { indexed: new Map(), fallback: [] };

  for await (const event of jsonEventsFrom(body)) {
    collectItem(event, collected);
    const partial = partialEvent(event, prefix, responseFormat);

    if (partial !== null && typeof partial['type'] === 'string')
      yield { ...partial, type: partial['type'] };

    for (const completed of completedEvents(event, collected, prefix, responseFormat)) {
      yield { ...completed, type: String(completed['type']) };
    }
  }
}

export function codexImageStreamResponse(
  answer: Response,
  prefix: string,
  responseFormat: string,
): Response {
  if (!answer.ok || answer.body === null) return answer;

  return new Response(namedSseBodyFrom(imageEvents(answer.body, prefix, responseFormat)), {
    status: answer.status,
    headers: { 'content-type': 'text/event-stream' },
  });
}

export async function codexImageJsonResponse(
  answer: Response,
  responseFormat: string,
): Promise<Response> {
  if (!answer.ok || answer.body === null) return answer;

  const collected: CollectedImages = { indexed: new Map(), fallback: [] };

  for await (const event of jsonEventsFrom(answer.body)) {
    collectItem(event, collected);

    if (event.type === 'response.completed') {
      const extraction = extractCodexImageResults(event, collected.indexed, collected.fallback);

      return jsonResponse(imageApiBody(extraction, responseFormat), 200);
    }
  }

  return Response.json(
    { error: { message: 'upstream did not return image output' } },
    { status: 502 },
  );
}
