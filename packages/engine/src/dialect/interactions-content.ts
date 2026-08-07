import type { HubContentBlock, HubDocumentBlock, HubImageSource, HubToolUseBlock } from './hub';
import type { InteractionsContentPart, InteractionsStep } from './interactions-wire';

import { imageSourceFromUrl } from './hub-build';

export function interactionsText(
  value: string | readonly InteractionsContentPart[] | undefined,
): string {
  if (typeof value === 'string') return value;

  return (value ?? []).flatMap((part) => ('text' in part ? [part.text] : [])).join('');
}

function mediaUrl(part: Extract<InteractionsContentPart, { type: 'image' }>): string | undefined {
  if (part.uri !== undefined) return part.uri;
  if (part.data === undefined) return undefined;

  return `data:${part.mime_type ?? 'image/png'};base64,${part.data}`;
}

function dataUri(value: string): { mediaType: string; data: string } | null {
  const matched = /^data:([^;]+);base64,(.*)$/su.exec(value);

  return matched?.[1] === undefined || matched[2] === undefined
    ? null
    : { mediaType: matched[1], data: matched[2] };
}

function namedDocumentBlock(
  part: Extract<InteractionsContentPart, { type: 'document' }>,
): HubDocumentBlock[] {
  return [
    {
      type: 'document',
      source: { type: 'base64', mediaType: part.mime_type, data: part.data },
      filename: part.name ?? 'document',
    },
  ];
}

function fileDocumentBlock(
  part: Extract<InteractionsContentPart, { type: 'file' }>,
): HubDocumentBlock[] {
  const source = fileSource(part);

  return source === null
    ? []
    : [
        {
          type: 'document',
          source: { type: 'base64', mediaType: source.mediaType, data: source.data },
          filename: part.file?.filename ?? part.name ?? 'document',
        },
      ];
}

function fileSource(
  part: Extract<InteractionsContentPart, { type: 'file' }>,
): { mediaType: string; data: string } | null {
  const nested = part.file === undefined ? null : dataUri(part.file.file_data);

  if (nested !== null) return nested;
  if (part.data === undefined) return null;

  return { mediaType: part.mime_type ?? 'application/octet-stream', data: part.data };
}

function documentBlock(
  part: Exclude<InteractionsContentPart, { text: string }>,
): HubDocumentBlock[] {
  if (part.type === 'document') return namedDocumentBlock(part);
  if (part.type === 'file') return fileDocumentBlock(part);

  return [];
}

function namedMediaBlock(
  part: Extract<InteractionsContentPart, { type: 'audio' | 'video' }>,
): HubContentBlock[] {
  return [
    {
      type: part.type,
      source: { type: 'base64', mediaType: part.mime_type, data: part.data },
    },
  ];
}

function isNamedMedia(
  part: InteractionsContentPart,
): part is Extract<InteractionsContentPart, { type: 'audio' | 'video' }> {
  return part.type === 'audio' || part.type === 'video';
}

function contentPartBlock(part: InteractionsContentPart): HubContentBlock[] {
  if ('text' in part) return [{ type: 'text', text: part.text }];
  if (isNamedMedia(part)) return namedMediaBlock(part);
  if (part.type !== 'image') return documentBlock(part);

  const url = mediaUrl(part);

  return url === undefined ? [] : [{ type: 'image', source: imageSourceFromUrl(url) }];
}

export function hubBlocksFromInteractionsContent(
  value: string | readonly InteractionsContentPart[],
): HubContentBlock[] {
  return typeof value === 'string'
    ? [{ type: 'text', text: value }]
    : value.flatMap(contentPartBlock);
}

export function interactionsImagePart(source: HubImageSource): InteractionsContentPart {
  return source.type === 'url'
    ? { type: 'image', uri: source.url }
    : { type: 'image', data: source.data, mime_type: source.mediaType };
}

export function interactionsPartFromHubMedia(
  block: Extract<HubContentBlock, { type: 'image' | 'audio' | 'video' | 'document' }>,
): InteractionsContentPart | null {
  if (block.type === 'image') return interactionsImagePart(block.source);

  if (block.type === 'document') {
    return {
      type: 'file',
      data: block.source.data,
      mime_type: block.source.mediaType,
      name: block.filename,
    };
  }

  return block.source.type === 'base64'
    ? { type: block.type, data: block.source.data, mime_type: block.source.mediaType }
    : null;
}

export function isHubInteractionsMedia(
  block: HubContentBlock,
): block is Extract<HubContentBlock, { type: 'image' | 'audio' | 'video' | 'document' }> {
  return ['image', 'audio', 'video', 'document'].includes(block.type);
}

export function interactionsToolCall(block: HubToolUseBlock): InteractionsStep {
  return {
    type: 'function_call',
    id: block.id,
    call_id: block.id,
    name: block.name,
    arguments: block.input,
    ...(block.signature === undefined ? {} : { signature: block.signature }),
  };
}
