import type { HubImageBlock, HubTextBlock, HubToolResultBlock } from './hub';
import type { ResponsesFunctionCallOutputItem } from './responses-wire';

import { imageBlockFromDataUri } from './hub-build';
import { sanitizeToolId } from './tool-id';

function toolResultText(output: unknown): string {
  if (output === undefined) return '';

  return typeof output === 'string' ? output : JSON.stringify(output);
}

function fallbackPart(output: unknown): HubTextBlock | HubImageBlock {
  const text = toolResultText(output);

  return imageBlockFromDataUri(text) ?? { type: 'text', text };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function imagePart(part: Record<string, unknown>): HubImageBlock | null {
  const source = imageSource(part);

  if (source === null) return null;

  return {
    type: 'image',
    source: imageBlockFromDataUri(source.url)?.source ?? {
      type: 'url',
      url: source.url,
    },
    ...(source.detail === undefined ? {} : { detail: source.detail }),
  };
}

function imageSource(part: Record<string, unknown>): { url: string; detail?: string } | null {
  if (part['type'] === 'input_image' && typeof part['image_url'] === 'string') {
    return { url: part['image_url'], ...normalizedDetail(part['detail']) };
  }

  return legacyImageSource(part);
}

function legacyImageSource(part: Record<string, unknown>): { url: string; detail?: string } | null {
  const legacy = part['image_url'];

  return part['type'] === 'image_url' && isJsonObject(legacy) && typeof legacy['url'] === 'string'
    ? { url: legacy['url'], ...normalizedDetail(legacy['detail']) }
    : null;
}

function normalizedDetail(value: unknown): { detail?: string } {
  if (value === 'original') return { detail: 'high' };

  return typeof value === 'string' ? { detail: value } : {};
}

function textPart(part: Record<string, unknown>): HubTextBlock | null {
  const textType = part['type'] === 'input_text' || part['type'] === 'output_text';

  return textType && typeof part['text'] === 'string' ? { type: 'text', text: part['text'] } : null;
}

function outputPart(part: unknown): HubTextBlock | HubImageBlock {
  if (!isJsonObject(part)) return fallbackPart(part);

  return imagePart(part) ?? textPart(part) ?? fallbackPart(part);
}

function toolResultContent(output: unknown): readonly (HubTextBlock | HubImageBlock)[] {
  if (Array.isArray(output)) return output.map(outputPart);

  const parsed = typeof output === 'string' ? parsedImageOutput(output) : null;

  return parsed === null ? [fallbackPart(output)] : parsed.map(outputPart);
}

function parsedImageOutput(text: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(text);
    const parts = Array.isArray(parsed) ? parsed : [parsed];

    return parts.some(isImageOutputPart) ? parts : null;
  } catch {
    return null;
  }
}

function isImageOutputPart(value: unknown): boolean {
  return isJsonObject(value) && ['input_image', 'image_url'].includes(String(value['type']));
}

export function toolResultBlockOf(
  item: ResponsesFunctionCallOutputItem,
  inferredName?: string,
): HubToolResultBlock {
  const name = item.name ?? inferredName;

  return {
    type: 'tool_result',
    toolUseId: sanitizeToolId(item.call_id),
    ...(name === undefined ? {} : { name }),
    content: toolResultContent(item.output),
    ...(typeof item.output === 'string' ? {} : { structuredResult: item.output }),
  };
}
