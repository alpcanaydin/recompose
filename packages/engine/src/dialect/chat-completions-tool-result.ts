import type { ChatToolMessage } from './chat-completions-wire';
import type { HubImageBlock, HubTextBlock, HubToolResultBlock } from './hub';

import { hubBreakpointFrom } from './chat-completions-cache';
import { imageSourceFromUrl } from './hub-build';
import { sanitizeToolId } from './tool-id';

type ToolOutputPart = { block: HubTextBlock | HubImageBlock; output: Record<string, unknown> };
type ToolOutput = {
  content: readonly (HubTextBlock | HubImageBlock)[];
  structuredResult?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonText(value: unknown): string {
  return JSON.stringify(value);
}

function fallbackPart(value: unknown): ToolOutputPart {
  const text = jsonText(value);

  return { block: { type: 'text', text }, output: { type: 'input_text', text } };
}

function textPart(value: Record<string, unknown>): ToolOutputPart | null {
  if (value['type'] !== 'text' && value['type'] !== 'input_text') return null;
  if (typeof value['text'] !== 'string') return null;

  return {
    block: { type: 'text', text: value['text'] },
    output: { type: 'input_text', text: value['text'] },
  };
}

function imagePart(value: Record<string, unknown>): ToolOutputPart | null {
  const image = imageFields(value);

  if (image === null) return null;

  return {
    block: imageBlock(image),
    output: imageOutput(image),
  };
}

type ImageFields = { url: string; fileId?: string; detail?: string };

function imageBlock(image: ImageFields): HubImageBlock {
  return {
    type: 'image',
    source: imageSourceFromUrl(image.url),
    ...(image.detail === undefined ? {} : { detail: image.detail }),
  };
}

function imageOutput(image: ImageFields): Record<string, unknown> {
  return {
    type: 'input_image',
    ...(image.url === '' ? {} : { image_url: image.url }),
    ...(image.fileId === undefined ? {} : { file_id: image.fileId }),
    ...(image.detail === undefined ? {} : { detail: image.detail }),
  };
}

function imageFields(value: Record<string, unknown>): ImageFields | null {
  if (value['type'] === 'input_image') return flatImageFields(value);
  if (value['type'] !== 'image_url' || !isRecord(value['image_url'])) return null;

  return flatImageFields(value['image_url']);
}

function flatImageFields(value: Record<string, unknown>): ImageFields | null {
  const location = imageLocation(value);

  if (location === null) return null;

  return { ...location, ...imageDetail(value['detail']) };
}

function imageLocation(value: Record<string, unknown>): Pick<ImageFields, 'url' | 'fileId'> | null {
  const url = imageUrl(value);
  const fileId = stringValue(value, 'file_id');

  if (url === undefined && fileId === undefined) return null;

  return { url: url ?? '', ...optionalFileId(fileId) };
}

function imageUrl(value: Record<string, unknown>): string | undefined {
  return stringValue(value, 'image_url') ?? stringValue(value, 'url');
}

function optionalFileId(fileId: string | undefined): { fileId?: string } {
  return fileId === undefined ? {} : { fileId };
}

function stringValue(value: Record<string, unknown>, field: string): string | undefined {
  const candidate = value[field];

  return typeof candidate === 'string' ? candidate : undefined;
}

function imageDetail(value: unknown): { detail?: string } {
  return typeof value === 'string' ? { detail: value } : {};
}

function filePart(value: Record<string, unknown>): ToolOutputPart | null {
  if (value['type'] !== 'file' || !isRecord(value['file'])) return null;

  const file = value['file'];
  const supported = ['file_id', 'file_data', 'file_url'].some(
    (field) => typeof file[field] === 'string',
  );

  if (!supported) return null;

  return {
    block: { type: 'text', text: jsonText(value) },
    output: {
      type: 'input_file',
      ...stringField(file, 'file_id'),
      ...stringField(file, 'file_data'),
      ...stringField(file, 'file_url'),
      ...stringField(file, 'filename'),
    },
  };
}

function stringField(value: Record<string, unknown>, field: string): Record<string, string> {
  return typeof value[field] === 'string' ? { [field]: value[field] } : {};
}

function outputPart(value: unknown): ToolOutputPart {
  if (!isRecord(value)) return fallbackPart(value);

  return textPart(value) ?? imagePart(value) ?? filePart(value) ?? fallbackPart(value);
}

function structuredOutput(values: readonly unknown[]): ToolOutput {
  const parts = values.map(outputPart);

  return {
    content: parts.map((part) => part.block),
    structuredResult: parts.map((part) => part.output),
  };
}

function parsedImageArray(value: string): readonly unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) &&
      parsed.some((part) => isRecord(part) && imagePart(part) !== null)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function toolResultContent(content: unknown): ToolOutput {
  if (Array.isArray(content)) return structuredOutput(content);

  if (typeof content === 'string') {
    const parsed = parsedImageArray(content);

    return parsed === null
      ? { content: [{ type: 'text', text: content }] }
      : structuredOutput(parsed);
  }

  return { content: [{ type: 'text', text: jsonText(content) }] };
}

export function toolResultBlockFrom(message: ChatToolMessage): HubToolResultBlock {
  const cacheBreakpoint = hubBreakpointFrom(message.cache_control);
  const result = toolResultContent(message.content);

  return {
    type: 'tool_result',
    toolUseId: sanitizeToolId(message.tool_call_id ?? 'call_missing'),
    content: result.content,
    ...(result.structuredResult === undefined ? {} : { structuredResult: result.structuredResult }),
    ...(cacheBreakpoint === undefined ? {} : { cacheBreakpoint }),
  };
}
