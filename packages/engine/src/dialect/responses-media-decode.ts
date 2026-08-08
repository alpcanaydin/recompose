import type { HubContentBlock, HubDocumentBlock } from './hub';
import type { ResponsesContentPart } from './responses-wire';

import { imageSourceFromUrl } from './hub-build';
import { normalizeOpenAIFileData } from './openai-file-data';

function cacheBreakpoint(part: ResponsesContentPart) {
  const control = part.cache_control;

  return control === undefined
    ? {}
    : {
        cacheBreakpoint: {
          type: 'ephemeral' as const,
          ...(control.ttl === undefined ? {} : { ttl: control.ttl }),
        },
      };
}

function documentBlock(
  part: Extract<ResponsesContentPart, { type: 'input_file' | 'output_file' }>,
): HubDocumentBlock {
  const normalized = normalizeOpenAIFileData(part.filename, 'application/pdf', part.file_data);

  return {
    type: 'document',
    source: {
      type: 'base64',
      mediaType: normalized?.mediaType ?? 'application/pdf',
      data: normalized?.data ?? '',
    },
    filename: part.filename,
  };
}

export function hubBlockFromResponsesPart(part: ResponsesContentPart): HubContentBlock {
  if (part.type === 'input_text' || part.type === 'output_text') {
    return { type: 'text', text: part.text, ...cacheBreakpoint(part) };
  }

  if (part.type === 'input_image') return responseImageBlock(part);

  if (part.type === 'input_audio') {
    return {
      type: 'audio',
      source: {
        type: 'base64',
        mediaType: `audio/${part.input_audio.format}`,
        data: part.input_audio.data,
      },
    };
  }

  return documentBlock(part);
}

function responseImageBlock(
  part: Extract<ResponsesContentPart, { type: 'input_image' }>,
): HubContentBlock {
  const detail = normalizedImageDetail(part.detail);

  return {
    type: 'image',
    source: imageSourceFromUrl(part.image_url),
    ...(detail === undefined ? {} : { detail }),
  };
}

function normalizedImageDetail(value: unknown): string | undefined {
  if (value === 'original') return 'high';

  return value === 'high' || value === 'low' || value === 'auto' ? value : undefined;
}
