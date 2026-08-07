import type { HubContentBlock, HubDocumentBlock } from './hub';
import type { ResponsesContentPart } from './responses-wire';

import { imageSourceFromUrl } from './hub-build';

function documentBlock(
  part: Extract<ResponsesContentPart, { type: 'input_file' | 'output_file' }>,
): HubDocumentBlock {
  const matched = /^data:([^;]+);base64,(.*)$/su.exec(part.file_data);

  return {
    type: 'document',
    source: {
      type: 'base64',
      mediaType: matched?.[1] ?? 'application/pdf',
      data: matched?.[2] ?? '',
    },
    filename: part.filename,
  };
}

export function hubBlockFromResponsesPart(part: ResponsesContentPart): HubContentBlock {
  if (part.type === 'input_text' || part.type === 'output_text') {
    return { type: 'text', text: part.text };
  }

  if (part.type === 'input_image') {
    return { type: 'image', source: imageSourceFromUrl(part.image_url) };
  }

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
