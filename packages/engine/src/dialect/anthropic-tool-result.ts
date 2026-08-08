import type { AnthropicToolResultBlock } from './anthropic-wire';
import type { Fate } from './fates';
import type { HubToolResultBlock, HubToolResultContent } from './hub';

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textPart(value: JsonObject): HubToolResultContent | undefined {
  const text = value['text'];

  return value['type'] === 'text' && typeof text === 'string' ? { type: 'text', text } : undefined;
}

function imagePart(value: JsonObject): HubToolResultContent | undefined {
  if (value['type'] !== 'image' || !isRecord(value['source'])) return undefined;

  const source = value['source'];

  if (source['type'] === 'url' && typeof source['url'] === 'string') {
    return { type: 'image', source: { type: 'url', url: source['url'] } };
  }

  return base64Image(source);
}

function base64Image(source: JsonObject): HubToolResultContent | undefined {
  const mediaType = source['media_type'];
  const data = source['data'];

  return source['type'] === 'base64' && typeof mediaType === 'string' && typeof data === 'string'
    ? { type: 'image', source: { type: 'base64', mediaType, data } }
    : undefined;
}

function droppedPart(value: JsonObject, fates: Fate[]): void {
  const type = value['type'];

  if (type === 'search_result' || type === 'document') {
    fates.push({
      field: `tool_result[${type}]`,
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  }

  if (type === 'tool_reference') {
    fates.push({ field: 'tool_result[tool_reference]', disposition: 'mapped', to: 'absent' });
  }
}

function arrayPart(value: unknown, fates: Fate[]): HubToolResultContent | undefined {
  if (!isRecord(value)) return undefined;

  const carried = textPart(value) ?? imagePart(value);

  if (carried !== undefined) return carried;

  droppedPart(value, fates);

  return undefined;
}

function toolContent(content: unknown, fates: Fate[]): HubToolResultContent[] {
  if (content === undefined) return [];
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (Array.isArray(content)) return content.flatMap((part) => carriedArrayPart(part, fates));

  return objectContent(content);
}

function objectContent(content: unknown): HubToolResultContent[] {
  if (!isRecord(content)) return [];

  return [imagePart(content) ?? { type: 'text', text: JSON.stringify(content) }];
}

function carriedArrayPart(value: unknown, fates: Fate[]): HubToolResultContent[] {
  const carried = arrayPart(value, fates);

  return carried === undefined ? [] : [carried];
}

function structuredResult(content: unknown): unknown {
  if (!isRecord(content)) return undefined;

  return content['type'] === undefined ? content : undefined;
}

export function hubToolResultFrom(
  block: AnthropicToolResultBlock,
  fates: Fate[],
): HubToolResultBlock {
  const structured = structuredResult(block.content);
  const cache = block.cache_control;

  return {
    type: 'tool_result',
    toolUseId: block.tool_use_id,
    content: toolContent(block.content, fates),
    ...(structured === undefined ? {} : { structuredResult: structured }),
    ...(cache === undefined
      ? {}
      : {
          cacheBreakpoint: {
            type: 'ephemeral',
            ...(cache.ttl === undefined ? {} : { ttl: cache.ttl }),
          },
        }),
    ...(block.is_error === true ? { isError: true } : {}),
  };
}
